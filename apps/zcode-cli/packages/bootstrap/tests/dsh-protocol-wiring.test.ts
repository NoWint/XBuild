import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDshCatalogStore, createDshPackageCommand, createDshPackageStore } from "@zcode/adapters/dsh-plugins";
import { DshDomainError, startDshDomain } from "@zcode/dsh-runtime";
import { dshAttachResultSchema, dshEventSchema, dshResultSchema, type DshAttachment, type DshCommand, type DshEvent, type DshScope } from "@zcode/shared/dsh-compat";
import { zcodeProtocolMethods } from "@zcode/shared";
import * as controllerModule from "../src/dsh-controller/index.js";
import type { DshController } from "../src/dsh-controller/contract.js";
import { ZCodeProtocolAgentServer, type ZCodeProtocolAgentDependencies } from "../src/zcode-protocol/server.js";
import { diagnostic } from "../src/dsh-controller/projection.js";

const roots: string[] = [];
const owners: Array<{ shutdown(): Promise<void> }> = [];
const anchor = fileURLToPath(new URL("../../dsh-runtime/package.json", import.meta.url));
const deadline = 30_000;

async function setup(packageScript?: (root: string) => string) {
  const root = await mkdtemp(join(tmpdir(), "xbuild-dsh-protocol-"));
  roots.push(root);
  const source = join(root, "plugin");
  const workspacePath = join(root, "workspace");
  await Promise.all([mkdir(source), mkdir(workspacePath)]);
  await writeFile(join(source, "package.json"), JSON.stringify({
    name: "protocol-native", version: "1.0.0", type: "module", main: "./index.mjs",
    ...(packageScript ? { dependencies: { "controlled-dependency": "1.0.0" } } : {}),
  }));
  const original = `export const name='protocol-native'; export const inject=['connection']; export function apply(ctx) { ctx.connection.fetch.register({path:'/api/bytes',methods:['GET'],requestBody:'buffered',fetch:async()=>new Response(new Uint8Array([0,255,10,13,128]))}); }`;
  await writeFile(join(source, "index.mjs"), original);
  const scope: DshScope = { workspacePath, workspaceIdentity: "ssh:protocol:/workspace", remoteSessionId: "remote-one" };
  const packages = createDshPackageStore({
    root: join(root, "inventory"), runtimeVersions: { "@deepseek-ai/dsh": "0.2.2-rc.3" },
    ...(packageScript ? { packageCommand: createDshPackageCommand({
      executable: process.execPath, prefixArgs: ["-e", packageScript(root)], timeoutMs: 20_000,
    }) } : {}),
  });
  const controller = controllerModule.createDshController({
    packages, catalogs: () => createDshCatalogStore({ root: join(root, "catalogs") }),
    runtimeVersions: { "@deepseek-ai/dsh": "0.2.2-rc.3" },
    installationAnchor: anchor, startDomain: startDshDomain, runner: { executable: process.execPath },
  });
  owners.push(controller);
  return { root, source, scope, packages, controller, original };
}

function serverFor(controller: DshController | Promise<DshController>) {
  const createZCodeApp = vi.fn(() => { throw new Error("DSH must not create a ZCode session"); });
  const deps: ZCodeProtocolAgentDependencies & { createDshController(): Promise<DshController> } = {
    createZCodeApp, createDshController: () => Promise.resolve(controller),
  };
  const server = new ZCodeProtocolAgentServer(deps);
  owners.push(server);
  return { server, createZCodeApp };
}

async function value(server: ZCodeProtocolAgentServer, scope: DshScope, command: DshCommand) {
  const response = await dispatch(server, scope, command);
  if (!response || !("result" in response)) throw new Error(JSON.stringify(response));
  return dshResultSchema.parse(response.result).value;
}

async function authorize(server: ZCodeProtocolAgentServer, fixture: Awaited<ReturnType<typeof setup>>) {
  const prepared = await value(server, fixture.scope, {
    kind: "prepare", source: fixture.source,
    configPatches: [{ insert: [
      { id: "credentials", name: "@deepseek-ai/dsh-credentials-local", config: { watch: false } },
      { id: "connection", name: "@deepseek-ai/dsh-client-connection" },
    ] }],
  }) as { domainId: string; revision: string; digest: string };
  await value(server, fixture.scope, { kind: "grant", domainId: prepared.domainId, grant: {
    revision: prepared.revision, digest: prepared.digest, nativeCode: true, nativeUi: false,
    executionMode: "trusted-process", filesystem: "unrestricted", network: true,
    subprocess: true, installationScripts: [],
  } });
  return prepared;
}

async function dispatch(server: ZCodeProtocolAgentServer, scope: DshScope, command: DshCommand, id = "dsh") {
  return await server.handleMessage({ id, method: zcodeProtocolMethods.pluginsDshDispatch, params: { scope, command } });
}

afterEach(async () => {
  await Promise.allSettled(owners.splice(0).map((owner) => owner.shutdown()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("DSH protocol assembly and admission closure", () => {
  it("dispatches overview through the actual protocol server without creating a ZCode app", async () => {
    const fixture = await setup();
    const { server, createZCodeApp } = serverFor(fixture.controller);
    const response = await dispatch(server, fixture.scope, { kind: "overview" });
    expect(response).toEqual({ id: "dsh", result: { value: { catalogs: [], domains: [], runtimeVersions: { "@deepseek-ai/dsh": "0.2.2-rc.3" } } } });
    expect(createZCodeApp).not.toHaveBeenCalled();
  }, deadline);

  it("shutdown cancels and reaps a real prepare subprocess before returning without a late pointer", async () => {
    const fixture = await setup((root) => `require('fs').writeFileSync(${JSON.stringify(join(root, "installer.pid"))},String(process.pid));setInterval(()=>{},1000)`);
    const caller = new AbortController();
    const prepare = fixture.controller.dispatch({
      scope: fixture.scope, command: { kind: "prepare", source: fixture.source },
    }, { signal: caller.signal });
    const outcome = prepare.then(() => "published", (error) => error);
    let pid = 0;
    try {
      await vi.waitFor(async () => { pid = Number(await readFile(join(fixture.root, "installer.pid"), "utf8")); }, { timeout: 5000 });
      await fixture.controller.shutdown();
      expect(() => process.kill(pid, 0)).toThrow();
      expect(await outcome).toMatchObject({ code: "DSH_COMMAND_CANCELLED" });
      expect(await fixture.packages.list(fixture.scope)).toEqual([]);
    } finally {
      caller.abort();
      await outcome;
    }
  }, deadline);

  it("rejects missing trusted distribution assets with a stable diagnostic", async () => {
    const root = await mkdtemp(join(tmpdir(), "xbuild-dsh-missing-distribution-"));
    roots.push(root);
    expect(controllerModule).toHaveProperty("createDefaultDshController", expect.any(Function));
    const factory = (controllerModule as typeof controllerModule & {
      createDefaultDshController(options: { cliStorageRoot: string; distribution: { kind: "staged"; root: string; runner: { kind: "node"; executable: string } } }): Promise<DshController>;
    }).createDefaultDshController;
    await expect(factory({
      cliStorageRoot: root,
      distribution: { kind: "staged", root: join(root, "not-staged"), runner: { kind: "node", executable: process.execPath } },
    })).rejects.toMatchObject({ code: "DSH_DISTRIBUTION_UNAVAILABLE" });
  });

  it("preserves immutable native bytes and validated notification envelopes through the real server", async () => {
    const fixture = await setup();
    const { server, createZCodeApp } = serverFor(fixture.controller);
    const events: DshEvent[] = [];
    const chunks: Buffer[] = [];
    const end = Promise.withResolvers<void>();
    server.setNotificationSink((message) => {
      expect(message.method).toBe("plugins/dsh/event");
      expect("params" in message).toBe(true);
      const event = dshEventSchema.parse(message.params);
      events.push(event);
      if (event.kind !== "stream") return;
      const payload = event.payload as { event: string; chunkBase64?: string };
      if (payload.event === "chunk") chunks.push(Buffer.from(payload.chunkBase64!, "base64"));
      if (payload.event === "end") end.resolve();
    });
    const prepared = await authorize(server, fixture);
    await value(server, fixture.scope, { kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    const attachment = dshAttachResultSchema.parse(await value(server, fixture.scope, {
      kind: "attach", domainId: prepared.domainId, attachmentId: "native-one", clientMode: "desktop-continuous",
    })).attachment;
    const response = await value(server, fixture.scope, {
      kind: "invoke", attachment, callId: "native-bytes", request: { kind: "fetch", path: "/api/bytes" },
    }) as { streamId?: string; bodyBase64?: string };
    if (response.streamId) await end.promise;
    else chunks.push(Buffer.from(response.bodyBase64!, "base64"));
    expect(Buffer.concat(chunks)).toEqual(Buffer.from([0, 255, 10, 13, 128]));
    expect(events).toContainEqual(expect.objectContaining({
      scope: fixture.scope, domainId: prepared.domainId, revision: prepared.revision, generation: 1,
      kind: "lifecycle", payload: { state: "running" },
    }));
    expect(events.some((event) => event.kind === "stream" && event.attachmentId === "native-one")).toBe(true);
    expect(events.every((event) => !("token" in event))).toBe(true);
    for (const [scope, lease] of [
      [{ ...fixture.scope, workspaceIdentity: "ssh:foreign:/workspace" }, attachment],
      [{ ...fixture.scope, remoteSessionId: "remote-other" }, attachment],
      [fixture.scope, { ...attachment, token: "foreign-owner-token" }],
    ] as Array<[DshScope, DshAttachment]>) {
      expect(await dispatch(server, scope, { kind: "invoke", attachment: lease, callId: "foreign", request: { kind: "plugins" } }))
        .toMatchObject({ error: { data: { code: "DSH_ATTACHMENT_STALE" } } });
    }
    const malformed = await server.handleMessage({
      id: "invalid", method: zcodeProtocolMethods.pluginsDshDispatch,
      params: { scope: fixture.scope, command: { kind: "overview", injected: "private-credential" } },
    });
    expect(malformed).toMatchObject({ error: { code: -32602, data: { code: "DSH_INVALID_PARAMS" } } });
    expect(JSON.stringify(malformed)).not.toContain("private-credential");
    expect(createZCodeApp).not.toHaveBeenCalled();
    expect(await readFile(join(fixture.source, "index.mjs"), "utf8")).toBe(fixture.original);
    await server.shutdown();
    expect(server.shutdown()).toBe(server.shutdown());
    expect(await dispatch(server, fixture.scope, { kind: "overview" })).toMatchObject({ error: expect.any(Object) });
  }, deadline);

  it("shares first creation and drains a late real controller after disconnect without reopening admission", async () => {
    const fixture = await setup();
    const deferred = Promise.withResolvers<DshController>();
    const createDshController = vi.fn(() => deferred.promise);
    const server = new ZCodeProtocolAgentServer({
      createZCodeApp: () => { throw new Error("Unexpected ZCode session"); },
      createDshController,
    });
    owners.push(server);
    const first = dispatch(server, fixture.scope, { kind: "overview" }, "one");
    const second = dispatch(server, fixture.scope, { kind: "overview" }, "two");
    await vi.waitFor(() => expect(createDshController).toHaveBeenCalledOnce());
    server.disconnectClient(new Error("transport closed"));
    let closed = false;
    const shutdown = server.shutdown().then(() => { closed = true; });
    await Promise.resolve();
    expect(closed).toBe(false);
    deferred.resolve(fixture.controller);
    await shutdown;
    for (const response of await Promise.all([first, second])) {
      expect(response).toMatchObject({ error: { data: { code: "DSH_CONTROLLER_CLOSED" } } });
    }
    await expect(fixture.controller.dispatch({ scope: fixture.scope, command: { kind: "overview" } }))
      .rejects.toMatchObject({ code: "DSH_CONTROLLER_CLOSED" });
    expect(await dispatch(server, fixture.scope, { kind: "overview" })).toMatchObject({ error: expect.any(Object) });
  }, deadline);

  it("leaves ordinary and malformed traffic lazy and does not leak third-party startup errors", async () => {
    const fixture = await setup();
    const createDshController = vi.fn(() => fixture.controller);
    const server = new ZCodeProtocolAgentServer({
      createZCodeApp: () => { throw new Error("Unexpected ZCode session"); }, createDshController,
    });
    owners.push(server);
    await server.handleMessage({ id: "capabilities", method: zcodeProtocolMethods.runtimeCapabilities, params: {} });
    await server.handleMessage({ id: "invalid", method: zcodeProtocolMethods.pluginsDshDispatch, params: { bad: true } });
    expect(createDshController).not.toHaveBeenCalled();
    await writeFile(join(fixture.source, "index.mjs"), `export const name='protocol-native';export function apply(){throw new Error('Authorization: Bearer private-credential secret=private-secret');}`);
    const prepared = await authorize(server, fixture);
    const response = await dispatch(server, fixture.scope, { kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    expect(response).toMatchObject({ error: { data: { code: "DSH_DOMAIN_STARTUP_FAILED" } } });
    expect(JSON.stringify(response)).not.toMatch(/private-credential|private-secret|stack|Bearer/);
  }, deadline);

  it("default development launcher uses real pinned metadata and pnpm for an offline local dependency", async () => {
    const fixture = await setup();
    const helper = join(fixture.root, "helper");
    await mkdir(helper);
    await writeFile(join(helper, "package.json"), JSON.stringify({ name: "local-helper", version: "1.0.0" }));
    const originalManifest = JSON.parse(await readFile(join(fixture.source, "package.json"), "utf8"));
    await writeFile(join(fixture.source, "package.json"), JSON.stringify({
      ...originalManifest, dependencies: { "local-helper": `file:${helper}` },
      peerDependencies: {
        "@deepseek-ai/cordis": "4.1.0",
        "@deepseek-ai/dsh-tools": "0.2.2-rc.3",
        "@deepseek-ai/dsh-session-persistence-jsonl": "0.2.2-rc.3",
      },
    }));
    const controller = await controllerModule.createDefaultDshController({
      cliStorageRoot: fixture.root,
      distribution: {
        kind: "development", launcherAnchor: fileURLToPath(new URL("../package.json", import.meta.url)),
        runner: { kind: "node", executable: process.execPath },
      },
    });
    owners.push(controller);
    const { server } = serverFor(controller);
    const prepared = await authorize(server, fixture);
    expect(prepared).toMatchObject({ domainId: expect.any(String), digest: expect.any(String) });
    expect((await value(server, fixture.scope, { kind: "overview" }) as { runtimeVersions: Record<string, string> }).runtimeVersions)
      .toMatchObject({
        "@deepseek-ai/dsh": "0.2.2-rc.3", "@deepseek-ai/cordis": "4.1.0",
        "@deepseek-ai/dsh-tools": "0.2.2-rc.3", "@deepseek-ai/dsh-session-persistence-jsonl": "0.2.2-rc.3",
      });
    await value(server, fixture.scope, { kind: "set-enabled", domainId: prepared.domainId, enabled: true });
  }, deadline);

  it("stops a late real native startup before shutdown resolves and never activates its revision", async () => {
    const fixture = await setup();
    const ready = Promise.withResolvers<number>();
    const release = Promise.withResolvers<void>();
    const controller = controllerModule.createDshController({
      packages: fixture.packages,
      catalogs: () => createDshCatalogStore({ root: join(fixture.root, "startup-catalogs") }),
      runtimeVersions: { "@deepseek-ai/dsh": "0.2.2-rc.3" },
      installationAnchor: anchor, runner: { executable: process.execPath },
      async startDomain(options) {
        const native = await startDshDomain(options);
        ready.resolve(native.info.pid!);
        await release.promise;
        return native;
      },
    });
    owners.push(controller);
    const { server } = serverFor(controller);
    const prepared = await authorize(server, fixture);
    const startup = dispatch(server, fixture.scope, { kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    const pid = await ready.promise;
    let closed = false;
    const shutdown = server.shutdown().then(() => { closed = true; });
    try {
      expect(() => process.kill(pid, 0)).not.toThrow();
      await Promise.resolve();
      expect(closed).toBe(false);
    } finally {
      release.resolve();
      await shutdown;
    }
    expect(await startup).toMatchObject({ error: { data: { code: "DSH_CONTROLLER_CLOSED" } } });
    expect(() => process.kill(pid, 0)).toThrow();
    expect((await fixture.packages.list(fixture.scope))[0]).toMatchObject({ enabled: false, preparedRevision: prepared.revision });
    expect((await fixture.packages.list(fixture.scope))[0]?.activeRevision).toBeUndefined();
  }, deadline);

  it("rejects unavailable SEA and Electron package runners without launching a GUI", async () => {
    const fixture = await setup();
    for (const runner of [
      { kind: "sea" as const, executable: process.execPath },
      { kind: "electron-node" as const, executable: process.execPath, packageManagerExecutable: join(fixture.root, "missing-node") },
    ]) {
      await expect(controllerModule.createDefaultDshController({
        cliStorageRoot: fixture.root,
        distribution: {
          kind: "development", launcherAnchor: fileURLToPath(new URL("../package.json", import.meta.url)), runner,
        },
      })).rejects.toMatchObject({ code: "DSH_DISTRIBUTION_UNAVAILABLE" });
    }
  }, deadline);

  it("owner shutdown cancels a real update installer and preserves the retained revision", async () => {
    const fixture = await setup((root) => `const fs=require('fs');if(fs.existsSync(${JSON.stringify(join(root, "block-update"))})){fs.writeFileSync(${JSON.stringify(join(root, "installer.pid"))},String(process.pid));setInterval(()=>{},1000)}`);
    const initial = await fixture.controller.dispatch({ scope: fixture.scope, command: { kind: "prepare", source: fixture.source } });
    const prepared = initial.value as { domainId: string; revision: string };
    await writeFile(join(fixture.root, "block-update"), "");
    const caller = new AbortController();
    const update = fixture.controller.dispatch({
      scope: fixture.scope, command: { kind: "update", domainId: prepared.domainId },
    }, { signal: caller.signal }).then(() => "published", (error) => error);
    let pid = 0;
    try {
      await vi.waitFor(async () => { pid = Number(await readFile(join(fixture.root, "installer.pid"), "utf8")); }, { timeout: 5000 });
      await fixture.controller.shutdown();
      expect(await update).toMatchObject({ code: "DSH_COMMAND_CANCELLED" });
      expect(() => process.kill(pid, 0)).toThrow();
      expect((await fixture.packages.list(fixture.scope))[0]).toMatchObject({ preparedRevision: prepared.revision, revisions: [prepared.revision] });
    } finally {
      caller.abort();
      await update;
    }
  }, deadline);

  it("owner shutdown drains cancellable catalog transport IO before returning", async () => {
    const fixture = await setup();
    const installer = createDshPackageCommand({
      executable: process.execPath,
      prefixArgs: ["-e", `require('fs').writeFileSync(${JSON.stringify(join(fixture.root, "catalog.pid"))},String(process.pid));setInterval(()=>{},1000)`],
      timeoutMs: 20_000,
    });
    const catalogs = createDshCatalogStore({
      root: join(fixture.root, "controlled-catalogs"),
      httpsRequest: {
        async request(_url, options) {
          await installer.run([], { cwd: fixture.root, signal: options.signal });
          return { bytes: Buffer.from('{"name":"Controlled","plugins":[]}') };
        },
      },
    });
    const controller = controllerModule.createDshController({
      packages: fixture.packages, catalogs: () => catalogs,
      runtimeVersions: { "@deepseek-ai/dsh": "0.2.2-rc.3" },
      installationAnchor: anchor, startDomain: startDshDomain,
      runner: { executable: process.execPath },
    });
    owners.push(controller);
    const caller = new AbortController();
    const add = controller.dispatch({
      scope: fixture.scope, command: { kind: "add-catalog", url: "https://example.invalid/catalog.json" },
    }, { signal: caller.signal }).then(() => "published", (error) => error);
    let pid = 0;
    try {
      await vi.waitFor(async () => { pid = Number(await readFile(join(fixture.root, "catalog.pid"), "utf8")); }, { timeout: 5000 });
      await controller.shutdown();
      expect(await add).toMatchObject({ code: "DSH_COMMAND_CANCELLED" });
      expect(() => process.kill(pid, 0)).toThrow();
      expect(await catalogs.load()).toEqual([]);
    } finally {
      caller.abort();
      await add;
    }
  }, deadline);

  it("denies URL-normalized native UI paths before a real native-domain fetch without DOM trust", async () => {
    const fixture = await setup();
    const { server } = serverFor(fixture.controller);
    const prepared = await authorize(server, fixture);
    await value(server, fixture.scope, { kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    const attachment = dshAttachResultSchema.parse(await value(server, fixture.scope, {
      kind: "attach", domainId: prepared.domainId, attachmentId: "untrusted-ui", clientMode: "desktop-continuous",
    })).attachment;
    const paths = [
      "/api/../plugins/unadvertised.js",
      "/api/%2e%2e/plugins/unadvertised.js",
      "/api/.%2e/plugins/unadvertised.js",
    ];
    const responses = [];
    for (const [index, path] of paths.entries()) {
      responses.push(await dispatch(server, fixture.scope, {
        kind: "invoke", attachment, callId: `ui-bypass-${index}`, request: { kind: "fetch", path },
      }));
    }
    expect(responses).toEqual(paths.map(() => expect.objectContaining({
      error: expect.objectContaining({ data: expect.objectContaining({ code: "DSH_UI_NOT_AUTHORIZED" }) }),
    })));
  }, deadline);

  it("projects native failure diagnostics without arbitrary upstream credential text", () => {
    const result = diagnostic(new DshDomainError(
      "DSH_DOMAIN_REQUEST_FAILED",
      "Authorization: Bearer private-credential\ncustom credential private-secret",
    ));
    expect(result.code).toBe("DSH_DOMAIN_REQUEST_FAILED");
    expect(result.message).toBeTruthy();
    expect(JSON.stringify(result)).not.toMatch(/private-credential|private-secret|Bearer|stack/);
  });

  it("does not erase native quarantine protection when uninstall is retried after real cleanup failure", async () => {
    const fixture = await setup();
    await writeFile(join(fixture.source, "index.mjs"), `export const name='protocol-native';export function apply(ctx){ctx.effect(()=>async()=>{throw new Error('controlled native cleanup failure');});}`);
    const { server } = serverFor(fixture.controller);
    const prepared = await authorize(server, fixture);
    await value(server, fixture.scope, { kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    expect(await dispatch(server, fixture.scope, { kind: "set-enabled", domainId: prepared.domainId, enabled: false }))
      .toMatchObject({ error: { data: { code: "DSH_DOMAIN_SHUTDOWN_FAILED" } } });
    const record = (await fixture.packages.list(fixture.scope))[0]!;
    const marker = join(record.dataDirectory, ".xbuild-domain-owner.json");
    expect(JSON.parse(await readFile(marker, "utf8"))).toMatchObject({ state: "quarantined" });
    await value(server, fixture.scope, { kind: "grant", domainId: prepared.domainId, grant: {
      revision: prepared.revision, digest: prepared.digest, nativeCode: true, nativeUi: false,
      executionMode: "sandboxed", filesystem: "workspace", network: false, subprocess: false, installationScripts: [],
    } });
    expect(await dispatch(server, fixture.scope, { kind: "set-enabled", domainId: prepared.domainId, enabled: true }))
      .toMatchObject({ error: { data: { code: "DSH_DOMAIN_RESOURCE_QUARANTINED" } } });
    const response = await dispatch(server, fixture.scope, { kind: "uninstall", domainId: prepared.domainId, deleteData: true });
    expect(response).toMatchObject({ error: { data: { code: "DSH_NATIVE_DATA_MAINTENANCE_UNAVAILABLE" } } });
    expect(JSON.parse(await readFile(marker, "utf8"))).toMatchObject({ state: "quarantined" });
    expect((await fixture.packages.list(fixture.scope))[0]?.domainId).toBe(prepared.domainId);
  }, deadline);

  it("refuses data deletion without a native maintenance port before revoking a running domain", async () => {
    const fixture = await setup();
    const { server } = serverFor(fixture.controller);
    const prepared = await authorize(server, fixture);
    await value(server, fixture.scope, { kind: "set-enabled", domainId: prepared.domainId, enabled: true });
    const attachment = dshAttachResultSchema.parse(await value(server, fixture.scope, {
      kind: "attach", domainId: prepared.domainId, attachmentId: "still-admitted", clientMode: "desktop-continuous",
    })).attachment;
    const before = await fixture.packages.list(fixture.scope);
    expect(await dispatch(server, fixture.scope, { kind: "uninstall", domainId: prepared.domainId, deleteData: true }))
      .toMatchObject({ error: { data: { code: "DSH_NATIVE_DATA_MAINTENANCE_UNAVAILABLE" } } });
    expect(await fixture.packages.list(fixture.scope)).toEqual(before);
    expect(await value(server, fixture.scope, {
      kind: "invoke", attachment, callId: "still-running", request: { kind: "fetch", path: "/api/bytes" },
    })).toMatchObject({ status: 200 });
  }, deadline);
});
