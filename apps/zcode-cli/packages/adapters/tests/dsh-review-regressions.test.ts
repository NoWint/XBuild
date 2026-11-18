import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeHttpClientAdapter } from "../src/http/index.js";
import * as dsh from "../src/dsh-plugins/index.js";
import * as files from "../src/dsh-plugins/files.js";

const temporary: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
async function root() {
  const path = await mkdtemp(join(tmpdir(), "dsh-review-test-"));
  temporary.push(path);
  return path;
}
async function packageAt(path: string, manifest: Record<string, unknown>) {
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "package.json"), JSON.stringify(manifest));
  await writeFile(join(path, "index.js"), "export function apply() {}");
}
async function localFixture() {
  const path = await root();
  const source = join(path, "original");
  await packageAt(source, { name: "native", version: "1.0.0", main: "index.js" });
  const scope = { workspacePath: path };
  const store = dsh.createDshPackageStore({ root: join(path, "inventory"), runtimeVersions: {} });
  return { path, source, scope, store };
}

describe("DSH package review regressions", () => {
  it.each(["prepare", "update"] as const)(
    "refuses %s publication when owner cancellation arrives after the final real digest IO",
    async (operation) => {
      const { source, scope, store } = await localFixture();
      const initial = operation === "update" ? await store.prepare({ source, scope }) : undefined;
      const signal = new AbortController();
      const hashDirectory = files.hashDirectory;
      vi.spyOn(files, "hashDirectory").mockImplementation(async (...args) => {
        const digest = await hashDirectory(...args);
        signal.abort(new DOMException("Owner closed after digest", "AbortError"));
        return digest;
      });
      const attempt = operation === "prepare"
        ? store.prepare({ source, scope, signal: signal.signal })
        : store.update(initial!.domainId, scope, { signal: signal.signal });
      await expect(attempt).rejects.toMatchObject({ name: "AbortError" });
      const records = await store.list(scope);
      if (initial) expect(records[0]).toMatchObject({ preparedRevision: initial.revision, revisions: [initial.revision] });
      else expect(records).toEqual([]);
    },
  );

  it("rejects oversized serialized catalog refresh before replacing readable metadata", async () => {
    const path = await root();
    let value: unknown = { name: "Original", plugins: [{ npm: "native@1.0.0" }] };
    const store = dsh.createDshCatalogStore({
      root: path,
      httpsRequest: {
        async request() {
          return { bytes: Buffer.from(JSON.stringify(value)) };
        },
      },
    });
    const initial = await store.add("https://example.invalid/catalog.json");
    const metadataPath = join(path, "catalogs", `${initial.catalog.id}.json`);
    const before = await readFile(metadataPath, "utf8");
    value = {
      name: "Too wide",
      plugins: [{ npm: "native@2.0.0" }],
      largeOriginal: Array.from({ length: 49000 }, () => "x".repeat(77)),
    };
    expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThan(4 * 1024 * 1024);
    expect(Buffer.byteLength(JSON.stringify({ original: value }, null, 2))).toBeGreaterThan(
      4 * 1024 * 1024,
    );
    await expect(store.refresh(initial.catalog.id).then(() => "published")).rejects.toMatchObject({
      code: "DSH_INVALID_METADATA",
    });
    expect(await readFile(metadataPath, "utf8")).toBe(before);
    expect((await store.load())[0]?.catalog.name).toBe("Original");
  });

  it("preserves multiline original metadata through validated prepare and reconstruction", async () => {
    const { path, source, scope, store } = await localFixture();
    const original = {
      name: "native",
      version: "1.0.0",
      main: "index.js",
      description: "First line\nSecond line\twith detail",
      author: { name: "First author\nSecond author" },
    };
    await packageAt(source, original);
    const prepared = await store.prepare({ source, scope });
    const reloaded = await dsh
      .createDshPackageStore({
        root: join(path, "inventory"),
        runtimeVersions: {},
      })
      .readRevision(prepared.domainId, prepared.revision, scope);
    expect(reloaded.manifest.description).toBe("First line\nSecond line\twith detail");
    expect(reloaded.manifest.raw).toEqual(original);
    expect(dsh.dshPreparedRevisionSchema.safeParse(prepared).success).toBe(true);
  });

  it.each(["prepare", "configure"] as const)(
    "validates full domain before %s publishes a new revision",
    async (operation) => {
      const { path, source, scope, store } = await localFixture();
      const initial = await store.prepare({ source, scope });
      const domainPath = join(path, "inventory", "domains", initial.domainId, "domain.json");
      const record = JSON.parse(await readFile(domainPath, "utf8"));
      record.revisions = [
        initial.revision,
        ...Array.from({ length: 9999 }, (_, index) => `old-${index}`),
      ];
      const before = JSON.stringify(record);
      await writeFile(domainPath, before);
      await expect(
        operation === "prepare"
          ? store.prepare({ source, scope, domainId: initial.domainId })
          : store.configure(initial.domainId, [{ set: { value: true } }], scope),
      ).rejects.toMatchObject({ code: "DSH_INVALID_METADATA" });
      expect(await readFile(domainPath, "utf8")).toBe(before);
      expect((await store.list(scope))[0]?.preparedRevision).toBe(initial.revision);
    },
  );

  it("returns invalid for an oversized JSON array without throwing RangeError", () => {
    const value = Array(200000).fill(0);
    expect(dsh.dshDataSchema.safeParse(value).success).toBe(false);
  });

  it("reports oversized configuration as DSH_INVALID_METADATA without changing the pointer", async () => {
    const { source, scope, store } = await localFixture();
    const initial = await store.prepare({ source, scope });
    await expect(
      store.configure(initial.domainId, [Array(200000).fill(0)], scope),
    ).rejects.toMatchObject({ code: "DSH_INVALID_METADATA" });
    expect((await store.list(scope))[0]?.revisions).toEqual([initial.revision]);
  });

  it("retains original optionalDependencies as package-manager install input", async () => {
    const { path, source, scope } = await localFixture();
    const original = {
      name: "native",
      version: "1.0.0",
      main: "index.js",
      optionalDependencies: { "optional-helper": "1.0.0", "platform-helper": "2.0.0" },
    };
    await packageAt(source, original);
    const store = dsh.createDshPackageStore({
      root: join(path, "optional-inventory"),
      runtimeVersions: {},
      packageCommand: {
        async run(_args, { cwd }) {
          const input = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
          if (input.optionalDependencies?.["optional-helper"] === "1.0.0")
            await packageAt(join(cwd, "node_modules", "optional-helper"), {
              name: "optional-helper",
              version: "1.0.0",
              main: "index.js",
            });
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      },
    });
    const prepared = await store.prepare({ source, scope });
    expect(prepared.dependencyInventory).toContainEqual({
      name: "optional-helper",
      version: "1.0.0",
    });
    const profile = JSON.parse(
      await readFile(join(prepared.profileDirectory, "package.json"), "utf8"),
    );
    expect(profile.optionalDependencies).toEqual(original.optionalDependencies);
    expect(prepared.manifest.raw).toEqual(original);
  });

  it.each([
    {
      label: "root peer mismatch hidden by unrelated nested version",
      rootVersion: "1.0.0",
      peer: "^2.0.0",
      nestedClient: false,
      valid: false,
    },
    {
      label: "missing root peer falsely satisfied by unrelated nested copy",
      rootVersion: undefined,
      peer: "^2.0.0",
      nestedClient: false,
      valid: false,
    },
    {
      label: "valid coexisting nested peer versions",
      rootVersion: "1.0.0",
      peer: "^1.0.0",
      nestedClient: true,
      valid: true,
    },
  ])(
    "resolves $label from the actual requesting package",
    async ({ rootVersion, peer, nestedClient, valid }) => {
      const { path, source, scope } = await localFixture();
      await packageAt(source, {
        name: "native",
        version: "1.0.0",
        main: "index.js",
        dependencies: { "aa-client": "1.0.0", "zz-other": "1.0.0" },
      });
      const store = dsh.createDshPackageStore({
        root: join(path, "peer-inventory"),
        runtimeVersions: {},
        packageCommand: {
          async run(_args, { cwd }) {
            const modules = join(cwd, "node_modules");
            await packageAt(join(modules, "aa-client"), {
              name: "aa-client",
              version: "1.0.0",
              main: "index.js",
              peerDependencies: { helper: peer },
            });
            await packageAt(join(modules, "zz-other"), {
              name: "zz-other",
              version: "1.0.0",
              main: "index.js",
            });
            await packageAt(join(modules, "zz-other", "node_modules", "helper"), {
              name: "helper",
              version: "2.0.0",
              main: "index.js",
            });
            if (rootVersion)
              await packageAt(join(modules, "helper"), {
                name: "helper",
                version: rootVersion,
                main: "index.js",
              });
            if (nestedClient) {
              await packageAt(join(modules, "zz-other", "node_modules", "nested-client"), {
                name: "nested-client",
                version: "1.0.0",
                main: "index.js",
                peerDependencies: { helper: "^2.0.0" },
              });
            }
            return { exitCode: 0, stdout: "", stderr: "" };
          },
        },
      });
      const prepare = store.prepare({ source, scope });
      if (valid) {
        expect(
          (await prepare).dependencyInventory.filter((item) => item.name === "helper"),
        ).toEqual([
          { name: "helper", version: "1.0.0" },
          { name: "helper", version: "2.0.0" },
        ]);
      } else {
        await expect(prepare).rejects.toThrow(/peer.*helper/i);
        expect(await store.list(scope)).toEqual([]);
      }
    },
  );

  it("does not treat a runtime version declaration as an available runtime dependency", async () => {
    const { path, source, scope } = await localFixture();
    await packageAt(source, {
      name: "native",
      version: "1.0.0",
      main: "index.js",
      peerDependencies: { "missing-runtime": "^1.0.0" },
    });
    const store = dsh.createDshPackageStore({
      root: join(path, "phantom-inventory"),
      runtimeVersions: { "missing-runtime": "1.0.0" },
    });
    await expect(store.prepare({ source, scope })).rejects.toThrow(/missing-runtime.*missing/i);
    expect(await store.list(scope)).toEqual([]);
  });

  it.each(["available", "missing", "wrong-version"] as const)(
    "checks the actual explicit runtime fallback is %s",
    async (scenario) => {
      const { path, source, scope } = await localFixture();
      const runtimeDependencyRoot = join(path, "runtime");
      await packageAt(runtimeDependencyRoot, { name: "runtime", version: "1.0.0" });
      if (scenario !== "missing")
        await packageAt(join(runtimeDependencyRoot, "node_modules", "native-runtime"), {
          name: "native-runtime",
          version: scenario === "available" ? "1.0.0" : "2.0.0",
          main: "index.js",
        });
      await packageAt(source, {
        name: "native",
        version: "1.0.0",
        main: "index.js",
        peerDependencies: { "native-runtime": "^1.0.0" },
      });
      const store = dsh.createDshPackageStore({
        root: join(path, "fallback-inventory"),
        runtimeVersions: { "native-runtime": "1.0.0" },
        runtimeDependencyRoot,
      });
      if (scenario === "available") {
        expect((await store.prepare({ source, scope })).manifest.name).toBe("native");
      } else {
        await expect(store.prepare({ source, scope }).then(() => "published")).rejects.toThrow(
          /native-runtime|runtime/i,
        );
        expect(await store.list(scope)).toEqual([]);
      }
    },
  );

  it.each(["https://100.64.0.1/source", "https://198.18.0.1/source"])(
    "blocks non-public literal %s through actual HTTP egress",
    async (url) => {
      vi.stubGlobal("fetch", async () => new Response("unsafe response"));
      const request = dsh.createDshHttpsRequest();
      await expect(request.request(url, { maxBytes: 1024, timeoutMs: 100 })).rejects.toMatchObject({
        code: "DSH_HTTP_FAILED",
        cause: { code: "egress_blocked" },
      });
    },
  );

  it.each(["private DNS", "DNS rebinding"])(
    "blocks %s at the real resolution boundary without private connection",
    async (scenario) => {
      vi.stubGlobal("fetch", async () => new Response("unsafe response"));
      let lookups = 0;
      const httpClient = createNodeHttpClientAdapter({
        env: {},
        dnsLookup: async () => [
          {
            address:
              scenario === "DNS rebinding" && ++lookups === 1 ? "93.184.216.34" : "127.0.0.1",
            family: 4,
          },
        ],
      });
      const request = dsh.createDshHttpsRequest({ httpClient });
      await expect(
        request.request("https://source.example/source", { maxBytes: 1024, timeoutMs: 1000 }),
      ).rejects.toMatchObject({ code: "DSH_HTTP_FAILED", cause: { code: "egress_blocked" } });
    },
  );
});
