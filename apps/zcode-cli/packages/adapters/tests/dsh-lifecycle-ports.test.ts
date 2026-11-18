import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as dsh from "../src/dsh-plugins/index.js";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
async function root() {
  const path = await mkdtemp(join(tmpdir(), "dsh-ports-test-"));
  temporary.push(path);
  return path;
}

describe("DSH lifecycle ports", () => {
  it("persists original catalog metadata and refreshes atomically without deleting installed domains", async () => {
    expect(dsh.createDshCatalogStore).toBeTypeOf("function");
    const path = await root();
    let value = {
      name: "Original",
      plugins: [{ npm: "native@1.0.0", custom: { preserve: true } }],
    };
    const store = dsh.createDshCatalogStore({
      root: path,
      httpsRequest: {
        async request() {
          return { bytes: Buffer.from(JSON.stringify(value)) };
        },
      },
    });
    const record = await store.add("https://example.invalid/catalog.json");
    expect(record.original).toEqual(value);
    expect((await store.load())[0]?.catalog.entries[0]?.source.spec).toBe("native@1.0.0");
    value = { name: "Updated", plugins: [{ npm: "native@2.0.0", custom: { preserve: false } }] };
    expect((await store.refresh(record.catalog.id)).catalog.name).toBe("Updated");
    await mkdir(join(path, "domains", "existing"), { recursive: true });
    await writeFile(join(path, "domains", "existing", "keep"), "original");
    await store.remove(record.catalog.id);
    expect(await store.load()).toEqual([]);
    expect(await readFile(join(path, "domains", "existing", "keep"), "utf8")).toBe("original");
  });

  it("verifies HTTPS archive bytes before installation and retains declared integrity", async () => {
    const path = await root();
    const bytes = Buffer.from("opaque tarball fixture bytes");
    const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
    let requests = 0;
    const store = dsh.createDshPackageStore({
      root: join(path, "inventory"),
      runtimeVersions: {},
      httpsRequest: {
        async request() {
          requests++;
          return { bytes };
        },
      },
      packageCommand: {
        async run(args, { cwd }) {
          expect(args).toContain("--ignore-scripts");
          const archive = args[args.length - 1]!;
          expect(await readFile(archive.slice("file:".length))).toEqual(bytes);
          await writeFile(
            join(cwd, "package.json"),
            JSON.stringify({ dependencies: { native: "1.0.0" } }),
          );
          await mkdir(join(cwd, "node_modules", "native"), { recursive: true });
          await writeFile(
            join(cwd, "node_modules", "native", "package.json"),
            JSON.stringify({ name: "native", version: "1.0.0", main: "index.js" }),
          );
          await writeFile(
            join(cwd, "node_modules", "native", "index.js"),
            "export function apply() {}",
          );
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      },
    });
    const source = {
      kind: "https",
      spec: "https://example.invalid/plugin.tgz",
      integrity,
    } as const;
    const staged = await store.prepare({ source, scope: { workspacePath: path } });
    expect(staged.source).toEqual(source);
    expect(staged.dependencyInventory).toContainEqual({
      name: "native",
      version: "1.0.0",
      integrity,
    });
    await expect(
      store.prepare({
        source: { ...source, integrity: `sha512-${Buffer.alloc(64).toString("base64")}` },
        scope: { workspacePath: path },
      }),
    ).rejects.toMatchObject({ code: "DSH_INTEGRITY_MISMATCH" });
    expect(requests).toBe(2);
  });

  it("uses only explicit executable and sanitized environment with argument-array execution", async () => {
    expect(dsh.createDshPackageCommand).toBeTypeOf("function");
    const path = await root();
    const command = dsh.createDshPackageCommand({
      executable: process.execPath,
      prefixArgs: [
        "-e",
        "process.stdout.write(JSON.stringify({argv:process.argv.slice(1),env:process.env}))",
        "--",
      ],
    });
    const result = await command.run(["literal;not-a-shell", "$(not-expanded)"], { cwd: path });
    const actual = JSON.parse(result.stdout);
    expect(actual.argv).toEqual(["literal;not-a-shell", "$(not-expanded)"]);
    expect(actual.env.NODE_OPTIONS).toBeUndefined();
    expect(actual.env.npm_config_registry).toBeUndefined();
    expect(actual.env.PATH).toBeUndefined();
    expect(result.exitCode).toBe(0);
  });

  it("terminates command execution on cancellation or bounded output overflow", async () => {
    expect(dsh.createDshPackageCommand).toBeTypeOf("function");
    const path = await root();
    const noisy = dsh.createDshPackageCommand({
      executable: process.execPath,
      prefixArgs: ["-e", "process.stdout.write('x'.repeat(4096))"],
      maxOutputBytes: 64,
    });
    await expect(noisy.run([], { cwd: path })).rejects.toMatchObject({ code: "DSH_COMMAND_LIMIT" });
    const controller = new AbortController();
    const long = dsh.createDshPackageCommand({
      executable: process.execPath,
      prefixArgs: ["-e", "setInterval(()=>{},1000)"],
    });
    const pending = long.run([], { cwd: path, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "DSH_COMMAND_CANCELLED" });
  });

  it("keeps the last catalog after malformed refresh and loads it after store reconstruction", async () => {
    const path = await root();
    let content: unknown = { plugins: [{ npm: "native@1.0.0" }] };
    const options = {
      root: path,
      httpsRequest: {
        async request() {
          return { bytes: Buffer.from(JSON.stringify(content)) };
        },
      },
    };
    const store = dsh.createDshCatalogStore(options);
    const initial = await store.add("https://example.invalid/catalog.json");
    content = { plugins: "not-an-array" };
    await expect(store.refresh(initial.catalog.id)).rejects.toThrow();
    expect(
      (await dsh.createDshCatalogStore(options).load())[0]?.catalog.entries[0]?.source.spec,
    ).toBe("native@1.0.0");
  });
});
