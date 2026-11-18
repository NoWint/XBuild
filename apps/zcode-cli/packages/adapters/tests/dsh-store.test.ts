import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, access, rename, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
import { createDshPackageStore } from "../src/dsh-plugins/index.js";
import type { DshDomainGrant, DshPreparedRevision } from "../src/dsh-plugins/contract.js";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "dsh-store-test-"));
  temporary.push(root);
  const source = join(root, "original");
  await mkdir(source);
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "local-native",
      version: "1.0.0",
      type: "module",
      main: "index.js",
      dsh: { bundle: { patch: "cordis.patch.yml" } },
      scripts: { prepare: "node -e 'throw new Error(\"must not run\")'" },
      peerDependencies: { "@deepseek-ai/cordis": "~4.1.0" },
    }),
  );
  await writeFile(
    join(source, "index.js"),
    "export function apply(ctx) { ctx.provide('localCapability', true); }\n",
  );
  await writeFile(
    join(source, "cordis.patch.yml"),
    "- insert:\n    - id: local-native\n      name: local-native\n",
  );
  const scope = {
    workspacePath: root,
    workspaceIdentity: "remote:test:workspace-a",
    remoteSessionId: "remote-a",
  };
  const store = createDshPackageStore({
    root: join(root, "inventory"),
    runtimeVersions: { "@deepseek-ai/cordis": "4.1.0", "@deepseek-ai/dsh": "0.2.2-rc.3" },
    runtimeDependencyRoot: fileURLToPath(new URL("../../dsh-runtime", import.meta.url)),
  });
  return { root, source, scope, store };
}
function grant(revision: DshPreparedRevision): DshDomainGrant {
  return {
    revision: revision.revision,
    digest: revision.digest,
    nativeCode: true,
    nativeUi: false,
    executionMode: "sandboxed",
    filesystem: "none",
    network: false,
    subprocess: false,
    installationScripts: [],
  };
}

describe("immutable DSH package revisions", () => {
  it("stages a real local Bundle without executing scripts or modifying original bytes", async () => {
    const { source, scope, store } = await fixture();
    const before = await readFile(join(source, "package.json"), "utf8");
    const staged = await store.prepare({ source, scope });
    expect(staged.state).toBe("awaiting-trust");
    expect(staged.manifest.name).toBe("local-native");
    expect(staged.digest).toMatch(/^[a-f0-9]{64}$/);
    const profile = JSON.parse(
      await readFile(join(staged.profileDirectory, "package.json"), "utf8"),
    );
    expect(profile.dsh.profile.bundles).toEqual(["local-native"]);
    expect(await readFile(join(source, "package.json"), "utf8")).toBe(before);
    expect(await store.list(scope)).toMatchObject([
      { preparedRevision: staged.revision, enabled: false },
    ]);
    await expect(store.activate(staged.domainId, staged.revision, scope)).rejects.toThrow(/trust/i);
  });

  it("requires exact trust and detects code changes before activation", async () => {
    const { source, scope, store } = await fixture();
    const staged = await store.prepare({ source, scope });
    await expect(
      store.authorize(staged.domainId, { ...grant(staged), digest: "a".repeat(64) }, scope),
    ).rejects.toThrow(/digest|revision/i);
    await store.authorize(staged.domainId, grant(staged), scope);
    expect((await store.verify(staged.domainId, staged.revision, scope)).state).toBe("trusted");
    await writeFile(
      join(staged.profileDirectory, "node_modules", "local-native", "index.js"),
      "export const tampered = true;",
    );
    await expect(store.verify(staged.domainId, staged.revision, scope)).rejects.toThrow(
      /integrity|digest/i,
    );
  });

  it("does not reuse a same-path domain for another workspace identity", async () => {
    const { source, scope, store } = await fixture();
    const staged = await store.prepare({ source, scope });
    const foreign = {
      ...scope,
      workspaceIdentity: "remote:test:workspace-b",
      remoteSessionId: "remote-b",
    };
    expect(await store.list(foreign)).toEqual([]);
    await expect(store.readRevision(staged.domainId, staged.revision, foreign)).rejects.toThrow(
      /scope|workspace/i,
    );
    await expect(store.authorize(staged.domainId, grant(staged), foreign)).rejects.toThrow(
      /scope|workspace/i,
    );
  });

  it("retains the previous active revision when an update fails and supports explicit rollback", async () => {
    const { source, scope, store } = await fixture();
    const first = await store.prepare({ source, scope });
    await store.authorize(first.domainId, grant(first), scope);
    await store.activate(first.domainId, first.revision, scope);
    await writeFile(
      join(source, "index.js"),
      "export function apply(ctx) { ctx.provide('newCapability', true); }",
    );
    const second = await store.prepare({ source, scope, domainId: first.domainId });
    expect(second.digest).not.toBe(first.digest);
    expect(second.state).toBe("awaiting-trust");
    await expect(store.activate(second.domainId, second.revision, scope)).rejects.toThrow(/trust/i);
    expect((await store.list(scope))[0]?.activeRevision).toBe(first.revision);
    await store.authorize(second.domainId, grant(second), scope);
    await store.activate(second.domainId, second.revision, scope);
    expect((await store.list(scope))[0]?.previousRevision).toBe(first.revision);
    await store.activate(first.domainId, first.revision, scope);
    expect((await store.list(scope))[0]?.activeRevision).toBe(first.revision);
  });

  it("rejects unsupported peers and package paths before leaving a usable installation", async () => {
    const { source, scope, store } = await fixture();
    const path = join(source, "package.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.peerDependencies["@deepseek-ai/cordis"] = "^3.0.0";
    await writeFile(path, JSON.stringify(manifest));
    await expect(store.prepare({ source, scope })).rejects.toThrow(/peer|version/i);
    expect(await store.list(scope)).toEqual([]);
  });

  it("includes temporary-looking plugin files in the trusted code digest", async () => {
    const { source, scope, store } = await fixture();
    await writeFile(join(source, "payload.tmp"), "original executable payload");
    const staged = await store.prepare({ source, scope });
    await store.authorize(staged.domainId, grant(staged), scope);
    await writeFile(
      join(staged.profileDirectory, "node_modules", "local-native", "payload.tmp"),
      "changed executable payload",
    );
    await expect(store.verify(staged.domainId, staged.revision, scope)).rejects.toThrow(
      /integrity|digest/i,
    );
  });

  it("rejects a conflicting native runtime hidden in nested package dependencies", async () => {
    const { source, root, scope } = await fixture();
    const path = join(source, "package.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.dependencies = { complex: "1.0.0" };
    await writeFile(path, JSON.stringify(manifest));
    const store = createDshPackageStore({
      root: join(root, "nested-inventory"),
      runtimeVersions: { "@deepseek-ai/cordis": "4.1.0", "@deepseek-ai/dsh": "0.2.2-rc.3" },
      runtimeDependencyRoot: fileURLToPath(new URL("../../dsh-runtime", import.meta.url)),
      packageCommand: {
        async run(_args, { cwd }) {
          const packages = [
            [
              join(cwd, "node_modules", "complex"),
              {
                name: "complex",
                version: "1.0.0",
                dependencies: { "@deepseek-ai/cordis": "4.0.1" },
              },
            ],
            [
              join(cwd, "node_modules", "complex", "node_modules", "@deepseek-ai", "cordis"),
              { name: "@deepseek-ai/cordis", version: "4.0.1" },
            ],
          ] as const;
          for (const [directory, raw] of packages) {
            await mkdir(directory, { recursive: true });
            await writeFile(join(directory, "package.json"), JSON.stringify(raw));
          }
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      },
    });
    await expect(store.prepare({ source, scope })).rejects.toThrow(/runtime|peer|version/i);
    expect(await store.list(scope)).toEqual([]);
  });

  it("retains domain data on uninstall unless explicitly requested", async () => {
    const { source, scope, store } = await fixture();
    const staged = await store.prepare({ source, scope });
    const record = (await store.list(scope))[0]!;
    await mkdir(record.dataDirectory, { recursive: true });
    await writeFile(join(record.dataDirectory, "memory.json"), '{"value":1}');
    await store.uninstall(staged.domainId, scope);
    expect(await store.list(scope)).toEqual([]);
    await expect(access(join(record.dataDirectory, "memory.json"))).resolves.toBeUndefined();
  });

  it("rejects mutable Git and missing HTTPS integrity before invoking installation", async () => {
    const { scope, store } = await fixture();
    for (const source of [
      "github:owner/repo",
      "github:owner/repo#main",
      "https://example.invalid/plugin.tgz",
    ]) {
      await expect(store.prepare({ source, scope })).rejects.toMatchObject({
        code: source.startsWith("github:") ? "DSH_MUTABLE_SOURCE" : "DSH_INTEGRITY_REQUIRED",
      });
    }
  });

  it("rejects corrupt persisted metadata and foreign revision scope instead of casting JSON", async () => {
    const { source, scope, store, root } = await fixture();
    const staged = await store.prepare({ source, scope });
    const metadataPath = join(
      root,
      "inventory",
      "domains",
      staged.domainId,
      "revisions",
      staged.revision,
      "revision.json",
    );
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    for (const mutation of [
      { scope: { ...scope, workspaceIdentity: "remote:foreign" } },
      { scope: { ...scope, remoteSessionId: "foreign" } },
      { digest: "not-a-digest" },
      { manifest: { name: 42 } },
      { profileDirectory: "/outside" },
    ]) {
      await writeFile(metadataPath, JSON.stringify({ ...metadata, ...mutation }));
      await expect(
        store.readRevision(staged.domainId, staged.revision, scope),
      ).rejects.toMatchObject({
        code: mutation.scope ? "DSH_SCOPE_MISMATCH" : "DSH_INVALID_METADATA",
      });
    }
  });

  it("does not permit a legacy grant to authorize unrestricted native execution", async () => {
    const { source, scope, store } = await fixture();
    const staged = await store.prepare({ source, scope });
    const legacy = { ...grant(staged), filesystem: "unrestricted" };
    delete (legacy as Partial<DshDomainGrant>).executionMode;
    await expect(
      store.authorize(staged.domainId, legacy as DshDomainGrant, scope),
    ).rejects.toMatchObject({ code: "DSH_INVALID_METADATA" });
    expect(
      (
        await store.authorize(
          staged.domainId,
          {
            ...grant(staged),
            executionMode: "trusted-process",
            filesystem: "unrestricted",
            network: true,
            subprocess: true,
          },
          scope,
        )
      ).grant?.executionMode,
    ).toBe("trusted-process");
  });

  it("configures from immutable stored bytes without reinstallation and preserves old active revision", async () => {
    const { source, scope, store } = await fixture();
    const staged = await store.prepare({
      source,
      scope,
      configPatches: [{ set: { enabled: false } }],
    });
    await store.authorize(staged.domainId, grant(staged), scope);
    await store.activate(staged.domainId, staged.revision, scope);
    await rm(source, { recursive: true });
    const oldPatch = await readFile(join(staged.profileDirectory, "cordis.patch.yml"), "utf8");
    const oldCode = await readFile(
      join(staged.profileDirectory, "node_modules", "local-native", "index.js"),
      "utf8",
    );
    const configured = await store.configure(staged.domainId, [{ set: { enabled: true } }], scope);
    expect(configured.state).toBe("awaiting-trust");
    expect(configured.digest).not.toBe(staged.digest);
    expect(configured.provenance).toMatchObject({
      configuredFrom: staged.revision,
      source: { kind: "directory" },
    });
    expect(
      await readFile(
        join(configured.profileDirectory, "node_modules", "local-native", "index.js"),
        "utf8",
      ),
    ).toBe(oldCode);
    expect(await readFile(join(staged.profileDirectory, "cordis.patch.yml"), "utf8")).toBe(
      oldPatch,
    );
    expect(await readFile(join(configured.profileDirectory, "cordis.patch.yml"), "utf8")).toBe(
      oldPatch,
    );
    expect(
      JSON.parse(
        await readFile(join(configured.profileDirectory, ".xbuild-host-overlay.json"), "utf8"),
      ),
    ).toEqual([{ set: { enabled: true } }]);
    expect((await store.list(scope))[0]?.activeRevision).toBe(staged.revision);
    await writeFile(
      join(configured.profileDirectory, "node_modules", "local-native", "index.js"),
      "changed",
    );
    expect(
      await readFile(
        join(staged.profileDirectory, "node_modules", "local-native", "index.js"),
        "utf8",
      ),
    ).toBe(oldCode);
    expect(await store.verify(staged.domainId, staged.revision, scope)).toMatchObject({
      digest: staged.digest,
    });
  });

  it("updates from original source and accumulated configuration provenance", async () => {
    const { source, scope, store } = await fixture();
    const staged = await store.prepare({ source, scope, configPatches: [{ set: { first: 1 } }] });
    const configured = await store.configure(staged.domainId, [{ set: { second: 2 } }], scope);
    const updated = await store.update(staged.domainId, scope);
    expect(updated.revision).not.toBe(configured.revision);
    expect(updated.source).toEqual(staged.source);
    expect(updated.provenance.configPatches).toEqual([
      { set: { first: 1 } },
      { set: { second: 2 } },
    ]);
  });

  it("rejects redirected domain directories before opening another owner's operation lock", async () => {
    const { source, scope, store, root } = await fixture();
    const staged = await store.prepare({ source, scope });
    const domain = join(root, "inventory", "domains", staged.domainId);
    await rename(domain, `${domain}-original`);
    const outside = join(root, "foreign");
    await mkdir(outside);
    await writeFile(join(outside, ".operation-lock"), "foreign-owner-lock");
    await symlink(outside, domain, "dir");
    await expect(store.authorize(staged.domainId, grant(staged), scope)).rejects.toMatchObject({
      code: "DSH_INVALID_METADATA",
    });
    expect(await readFile(join(outside, ".operation-lock"), "utf8")).toBe("foreign-owner-lock");
  });

  it("rejects deeply nested configuration before persisting a new revision", async () => {
    const { source, scope, store } = await fixture();
    const staged = await store.prepare({ source, scope });
    let patch: import("../src/dsh-plugins/contract.js").DshData = true;
    for (let depth = 0; depth < 80; depth++) patch = { nested: patch };
    await expect(store.configure(staged.domainId, [patch], scope)).rejects.toMatchObject({
      code: "DSH_INVALID_METADATA",
    });
    expect((await store.list(scope))[0]?.revisions).toEqual([staged.revision]);
  });

  it("preserves arbitrary imported Profile metadata and YAML bytes while appending Host overlay", async () => {
    const { source, scope, store } = await fixture();
    const path = join(source, "package.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.dsh = {
      profile: { bundles: [], custom: { ordered: ["a", "b"] }, startup: "original" },
    };
    await writeFile(path, JSON.stringify(manifest));
    const originalPatch = await readFile(join(source, "cordis.patch.yml"), "utf8");
    const staged = await store.prepare({
      source,
      scope,
      configPatches: [{ id: "native", config: { first: 1 } }],
    });
    const hostManifest = JSON.parse(
      await readFile(join(staged.profileDirectory, "package.json"), "utf8"),
    );
    expect(hostManifest.dsh.profile).toEqual(manifest.dsh.profile);
    const configured = await store.configure(
      staged.domainId,
      [{ id: "native", config: { second: 2 } }],
      scope,
    );
    expect(await readFile(join(configured.profileDirectory, "cordis.patch.yml"), "utf8")).toBe(
      originalPatch,
    );
    expect(
      await readFile(
        join(configured.profileDirectory, "node_modules", "local-native", "package.json"),
        "utf8",
      ),
    ).toBe(JSON.stringify(manifest));
    expect(
      JSON.parse(
        await readFile(join(configured.profileDirectory, ".xbuild-host-overlay.json"), "utf8"),
      ),
    ).toEqual([
      { id: "native", config: { first: 1 } },
      { id: "native", config: { second: 2 } },
    ]);
  });
});
