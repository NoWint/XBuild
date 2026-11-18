import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createDshCatalogStore, createDshPackageStore } from "@zcode/adapters/dsh-plugins";
import { startDshDomain } from "@zcode/dsh-runtime";
import { dshAttachResultSchema, dshOverviewSchema, type DshAttachment, type DshCommand, type DshEvent, type DshJson, type DshScope } from "@zcode/shared/dsh-compat";
import * as controllerModule from "../src/dsh-controller/index.js";
import type { DshController } from "../src/dsh-controller/contract.js";

const roots: string[] = [];
const controllers: DshController[] = [];
const anchor = fileURLToPath(new URL("../../dsh-runtime/package.json", import.meta.url));
const deadline = 30_000;
const corePatches = [{ insert: [
  { id: "credentials", name: "@deepseek-ai/dsh-credentials-local", config: { watch: false } },
  { id: "connection", name: "@deepseek-ai/dsh-client-connection" },
] }];
const nativeSource = `
export const name = 'controller-native';
export const inject = ['connection'];
export function apply(ctx, config) {
  if (config?.fail) throw new Error('controlled native activation failure');
  if (config?.failClose) ctx.effect(() => async () => { throw new Error('controlled native cleanup failure'); });
  ctx.connection.fetch.register({
    path: '/api/native', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => Response.json({ pid: process.pid, config: config ?? {}, values: [false, 0, null] }),
  });
  ctx.connection.fetch.register({
    path: '/api/bytes', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => new Response(new Uint8Array([0, 255, 10, 13, 128])),
  });
  ctx.connection.fetch.register({
    path: '/api/burst', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => new Response(new ReadableStream({
      start(controller) { for (let index = 0; index < 40; index++) controller.enqueue(new Uint8Array(65536)); controller.close(); },
    })),
  });
}
`;

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "xbuild-dsh-controller-"));
  roots.push(root);
  const workspacePath = join(root, "workspace");
  const source = join(root, "original-plugin");
  await Promise.all([mkdir(workspacePath), mkdir(source)]);
  await writeFile(join(source, "package.json"), JSON.stringify({
    name: "controller-native", version: "1.0.0", type: "module", main: "./index.mjs",
  }));
  await writeFile(join(source, "index.mjs"), nativeSource);
  const scope: DshScope = { workspacePath, workspaceIdentity: "ssh:controller:/workspace", remoteSessionId: "remote-one" };
  const packages = createDshPackageStore({ root: join(root, "inventory"), runtimeVersions: { "@deepseek-ai/dsh": "0.2.2-rc.3" } });
  expect(controllerModule).toHaveProperty("createDshController", expect.any(Function));
  const controller = controllerModule.createDshController({
    packages, catalogs: () => createDshCatalogStore({ root: join(root, "catalogs") }),
    runtimeVersions: { "@deepseek-ai/dsh": "0.2.2-rc.3" },
    installationAnchor: anchor, startDomain: startDshDomain,
    runner: { executable: process.execPath },
  });
  controllers.push(controller);
  const command = (command: DshCommand) => controller.dispatch({ scope, command });
  return { root, source, scope, controller, command, packages };
}

async function authorized(fixture: Awaited<ReturnType<typeof setup>>) {
  const { value } = await fixture.command({ kind: "prepare", source: fixture.source, configPatches: corePatches });
  const prepared = value as { domainId: string; revision: string; digest: string };
  await fixture.command({
    kind: "grant", domainId: prepared.domainId,
    grant: {
      revision: prepared.revision, digest: prepared.digest, nativeCode: true,
      nativeUi: false, executionMode: "trusted-process", filesystem: "unrestricted",
      network: true, subprocess: true, installationScripts: [],
    },
  });
  return prepared;
}

async function attach(fixture: Awaited<ReturnType<typeof setup>>, domainId: string, attachmentId = "attachment-one") {
  return dshAttachResultSchema.parse((await fixture.command({
    kind: "attach", domainId, attachmentId, clientMode: "desktop-continuous",
  })).value).attachment;
}

async function configure(fixture: Awaited<ReturnType<typeof setup>>, prepared: { domainId: string; revision: string }, config: Record<string, DshJson>) {
  const original = await fixture.packages.readRevision(prepared.domainId, prepared.revision, fixture.scope);
  const patches = JSON.parse(await readFile(join(original.profileDirectory, "cordis.patch.yml"), "utf8"));
  const pluginId = patches.flatMap((patch: { insert?: Array<{ id: string; name: string }> }) => patch.insert ?? [])
    .find((entry: { name: string }) => entry.name === "controller-native").id;
  const next = (await fixture.command({ kind: "configure", domainId: prepared.domainId, patches: [{ id: pluginId, config }] })).value as { domainId: string; revision: string; digest: string };
  await fixture.command({ kind: "grant", domainId: next.domainId, grant: {
    revision: next.revision, digest: next.digest, nativeCode: true, nativeUi: false,
    executionMode: "trusted-process", filesystem: "unrestricted", network: true,
    subprocess: true, installationScripts: [],
  } });
  return next;
}

async function fetchBody(fixture: Awaited<ReturnType<typeof setup>>, attachment: DshAttachment, path: string, callId: string) {
  const chunks: Uint8Array[] = [];
  const done = Promise.withResolvers<void>();
  const events: DshEvent[] = [];
  const release = fixture.controller.subscribe((event) => {
    if (event.kind !== "stream" || event.attachmentId !== attachment.attachmentId) return;
    events.push(event);
    const payload = event.payload as { event: string; chunkBase64?: string; error?: DshJson };
    if (payload.event === "chunk") chunks.push(Buffer.from(payload.chunkBase64!, "base64"));
    if (payload.event === "end") done.resolve();
    if (payload.event === "error") done.reject(new Error(JSON.stringify(payload.error)));
  });
  try {
    const result = (await fixture.command({
      kind: "invoke", attachment, callId, request: { kind: "fetch", path },
    })).value as { bodyBase64?: string; streamId?: string };
    if (result.streamId) await done.promise;
    else if (result.bodyBase64) chunks.push(Buffer.from(result.bodyBase64, "base64"));
    return { bytes: Buffer.concat(chunks), events };
  } finally { release(); }
}

afterEach(async () => {
  await Promise.allSettled(controllers.splice(0).map((controller) => controller.shutdown()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("CLI DSH lifecycle and attachment owner", () => {
  it("keeps download and authorization separate from running a native domain", async () => {
    const fixture = await setup();
    const prepared = (await fixture.command({ kind: "prepare", source: fixture.source, configPatches: corePatches })).value as { domainId: string };
    const overview = dshOverviewSchema.parse((await fixture.command({ kind: "overview" })).value);
    expect(overview.domains[0]).toMatchObject({ enabled: false, state: "awaiting-trust", generation: 0, compatibility: "unverified" });
    await expect(fixture.command({ kind: "set-enabled", domainId: prepared.domainId, enabled: true })).rejects.toMatchObject({ code: "DSH_AWAITING_TRUST" });
    await expect(fixture.command({ kind: "attach", domainId: prepared.domainId, attachmentId: "untrusted", clientMode: "desktop-continuous" })).rejects.toMatchObject({ code: "DSH_DOMAIN_NOT_RUNNING" });
  }, deadline);

  it("runs a real immutable native plugin and preserves its response bytes through the owner", async () => {
    const fixture = await setup();
    const prepared = await authorized(fixture);
    await fixture.command({ kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    const attachment = await attach(fixture, prepared.domainId);
    const response = await fetchBody(fixture, attachment, "/api/native", "native-call");
    expect(JSON.parse(response.bytes.toString())).toMatchObject({ config: {}, values: [false, 0, null] });
    expect(await readFile(join(fixture.source, "index.mjs"), "utf8")).toBe(nativeSource);
    expect((await fetchBody(fixture, attachment, "/api/bytes", "bytes-call")).bytes).toEqual(Buffer.from([0, 255, 10, 13, 128]));
    expect(dshOverviewSchema.parse((await fixture.command({ kind: "overview" })).value).domains[0]).toMatchObject({ state: "running", enabled: true, generation: 1, activeRevision: prepared.revision });
    await fixture.command({ kind: "set-enabled", domainId: prepared.domainId, enabled: false });
    await expect(fixture.command({ kind: "invoke", attachment, callId: "late", request: { kind: "plugins" } })).rejects.toMatchObject({ code: "DSH_ATTACHMENT_STALE" });
    expect(dshOverviewSchema.parse((await fixture.command({ kind: "overview" })).value).domains[0]?.state).toBe("stopped");
  }, deadline);

  it("rejects a requested sandbox boundary when no real confinement implementation exists", async () => {
    const fixture = await setup();
    const prepared = (await fixture.command({ kind: "prepare", source: fixture.source, configPatches: corePatches })).value as { domainId: string; revision: string; digest: string };
    await fixture.command({ kind: "grant", domainId: prepared.domainId, grant: {
      revision: prepared.revision, digest: prepared.digest, nativeCode: true, nativeUi: false,
      executionMode: "sandboxed", filesystem: "workspace", network: false,
      subprocess: false, installationScripts: [],
    } });
    await expect(fixture.command({ kind: "set-enabled", domainId: prepared.domainId, enabled: true })).rejects.toMatchObject({ code: "DSH_CONFINEMENT_UNAVAILABLE" });
    expect(dshOverviewSchema.parse((await fixture.command({ kind: "overview" })).value).domains[0]).toMatchObject({ state: "environment-limited", enabled: false });
  }, deadline);

  it("rejects foreign tokens and same-path foreign identities without affecting the admitted caller", async () => {
    const fixture = await setup();
    const prepared = await authorized(fixture);
    await fixture.command({ kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    const attachment = await attach(fixture, prepared.domainId);
    for (const scope of [
      { ...fixture.scope, workspaceIdentity: "ssh:other:/workspace" },
      { ...fixture.scope, remoteSessionId: "remote-other" },
    ]) {
      await expect(fixture.controller.dispatch({ scope, command: { kind: "invoke", attachment, callId: "foreign", request: { kind: "plugins" } } }))
        .rejects.toMatchObject({ code: "DSH_ATTACHMENT_STALE" });
    }
    await expect(fixture.command({ kind: "invoke", attachment: { ...attachment, token: "a-different-owner-token" }, callId: "forged", request: { kind: "plugins" } }))
      .rejects.toMatchObject({ code: "DSH_ATTACHMENT_STALE" });
    expect((await fetchBody(fixture, attachment, "/api/bytes", "admitted")).bytes).toEqual(Buffer.from([0, 255, 10, 13, 128]));
  }, deadline);

  it("detaches one original Peer and keeps the other attachment operational", async () => {
    const fixture = await setup();
    const prepared = await authorized(fixture);
    await fixture.command({ kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    const first = await attach(fixture, prepared.domainId, "first");
    const second = await attach(fixture, prepared.domainId, "second");
    await fixture.command({ kind: "detach", attachment: first });
    await expect(fixture.command({ kind: "invoke", attachment: first, callId: "revoked", request: { kind: "plugins" } }))
      .rejects.toMatchObject({ code: "DSH_ATTACHMENT_STALE" });
    expect((await fetchBody(fixture, second, "/api/bytes", "remaining")).bytes).toEqual(Buffer.from([0, 255, 10, 13, 128]));
  }, deadline);

  it("restarts the retained original revision after a candidate fails actual native initialization", async () => {
    const fixture = await setup();
    const prepared = await authorized(fixture);
    await fixture.command({ kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    const first = await attach(fixture, prepared.domainId);
    const before = JSON.parse((await fetchBody(fixture, first, "/api/native", "before")).bytes.toString());
    const candidate = await configure(fixture, prepared, { fail: true });
    await expect(fixture.command({ kind: "set-enabled", domainId: prepared.domainId, enabled: true })).rejects.toMatchObject({ code: "DSH_DOMAIN_STARTUP_FAILED" });
    const overview = dshOverviewSchema.parse((await fixture.command({ kind: "overview" })).value);
    expect(overview.domains[0]).toMatchObject({
      state: "running", generation: 3, activeRevision: prepared.revision, preparedRevision: candidate.revision,
    });
    const restored = await attach(fixture, prepared.domainId, "restored");
    const after = JSON.parse((await fetchBody(fixture, restored, "/api/native", "after")).bytes.toString());
    expect(after.config).toEqual({});
    expect(after.pid).not.toBe(before.pid);
    expect(await readFile(join(fixture.source, "index.mjs"), "utf8")).toBe(nativeSource);
  }, deadline);

  it("reports a real replay gap rather than treating an evicted byte stream as complete history", async () => {
    const fixture = await setup();
    const prepared = await authorized(fixture);
    await fixture.command({ kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    const attachment = await attach(fixture, prepared.domainId);
    expect((await fetchBody(fixture, attachment, "/api/burst", "burst")).bytes.byteLength).toBe(40 * 65536);
    const result = (await fixture.command({ kind: "events", attachment, afterSequence: 0 })).value as { gap: boolean; events: DshEvent[] };
    expect(result.gap).toBe(true);
    expect(result.events[0]!.sequence).toBeGreaterThan(1);
    expect(result.events.every((event) => !("token" in event))).toBe(true);
  }, deadline);

  it("keeps a rejected original cleanup visible as failed instead of silently projecting stopped", async () => {
    const fixture = await setup();
    const prepared = await authorized(fixture);
    await configure(fixture, prepared, { failClose: true });
    await fixture.command({ kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    await expect(fixture.command({ kind: "set-enabled", domainId: prepared.domainId, enabled: false })).rejects.toMatchObject({ code: "DSH_DOMAIN_SHUTDOWN_FAILED" });
    expect(dshOverviewSchema.parse((await fixture.command({ kind: "overview" })).value).domains[0]).toMatchObject({
      enabled: true, state: "failed",
    });
  }, deadline);
});
