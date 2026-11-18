import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildBuiltinCatalog, discoverLocalDsh } from "../src/dsh-plugins/index.js";

const roots: string[] = [];

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dsh-discovery-"));
  roots.push(root);
  return root;
}

/** 写一个最小但真实形状的 DSH profile：package.json + node_modules/<pkg>。 */
async function writeProfile(
  home: string,
  name: string,
  bundles: string[],
  packages: Array<{ name: string; manifest: Record<string, unknown> }>,
): Promise<void> {
  const profile = join(home, "profiles", name);
  await mkdir(profile, { recursive: true });
  await writeFile(
    join(profile, "package.json"),
    JSON.stringify({ name: `dsh-profile-${name}`, private: true, dsh: { profile: { bundles } } }),
  );
  for (const pkg of packages) {
    const directory = join(profile, "node_modules", ...pkg.name.split("/"));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "package.json"), JSON.stringify(pkg.manifest));
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("local DSH discovery", () => {
  it("returns an empty result instead of failing when no DSH home exists", async () => {
    const home = join(await fixtureRoot(), "absent");
    const found = await discoverLocalDsh({ home });
    expect(found).toEqual({ home, profiles: [], plugins: [], diagnostics: [] });
  });

  it("lists third-party plugins with their declared capability surfaces", async () => {
    const home = await fixtureRoot();
    await writeProfile(home, "desktop", ["@deepseek-ai/dsh-base", "dsh-prompt-inject"], [{
      name: "dsh-prompt-inject",
      manifest: {
        name: "dsh-prompt-inject",
        version: "1.1.2",
        description: "Inject a prompt",
        type: "module",
        main: "index.js",
        exports: { ".": "./index.js", "./client": "./client.js" },
        dsh: { bundle: { patch: "./cordis.patch.yml" }, client: { platform: "web" } },
      },
    }]);

    const found = await discoverLocalDsh({ home });
    expect(found.profiles).toEqual([{ name: "desktop", directory: join(home, "profiles", "desktop"), bundles: ["@deepseek-ai/dsh-base", "dsh-prompt-inject"] }]);
    expect(found.plugins).toHaveLength(1);
    expect(found.plugins[0]).toMatchObject({
      packageName: "dsh-prompt-inject",
      version: "1.1.2",
      profile: "desktop",
      thirdParty: true,
      source: { kind: "directory" },
    });
    expect(found.plugins[0]!.manifest.bundlePatches).toEqual(["./cordis.patch.yml"]);
    expect(found.diagnostics).toEqual([]);
  });

  // 回归：裸依赖（如 @standard-schema/spec）也有合法入口，但它不是用户可安装的插件。
  // 早期实现把所有可解析包都当插件列出，会误导用户去"安装"一个运行时依赖。
  it("does not report plain dependencies as installable plugins", async () => {
    const home = await fixtureRoot();
    await writeProfile(home, "web", ["@deepseek-ai/dsh-base"], [{
      name: "@standard-schema/spec",
      manifest: {
        name: "@standard-schema/spec",
        version: "1.1.0",
        exports: { ".": "./dist/index.js" },
      },
    }]);
    const found = await discoverLocalDsh({ home });
    expect(found.plugins).toEqual([]);
  });

  it("skips official runtime packages and reports broken links as diagnostics", async () => {
    const home = await fixtureRoot();
    await writeProfile(home, "web", ["@deepseek-ai/dsh-base"], [{
      name: "@deepseek-ai/dsh-base",
      manifest: { name: "@deepseek-ai/dsh-base", version: "0.2.2-rc.3", main: "index.js" },
    }]);
    const profile = join(home, "profiles", "web");
    // 失效软链是真实状态（link: 依赖源目录被删），必须作为诊断暴露而不是静默跳过。
    await symlink(join(home, "missing-target"), join(profile, "node_modules", "dsh-gone"), "dir");

    const found = await discoverLocalDsh({ home });
    expect(found.plugins).toEqual([]);
    expect(found.diagnostics).toHaveLength(1);
    expect(found.diagnostics[0]!.subject).toBe("dsh-gone");
  });

  it("reports a manifest that fails plugin admission instead of listing it", async () => {
    const home = await fixtureRoot();
    await writeProfile(home, "web", ["dsh-broken"], [{
      name: "dsh-broken",
      manifest: { name: "dsh-broken", version: "not-a-version", main: "index.js" },
    }]);
    const found = await discoverLocalDsh({ home });
    expect(found.plugins).toEqual([]);
    expect(found.diagnostics).toHaveLength(1);
    expect(found.diagnostics[0]!.message).toMatch(/semantic version/i);
  });
});

describe("built-in marketplace catalog", () => {
  it("exposes curated entries as unverified npm sources", () => {
    const catalog = buildBuiltinCatalog();
    expect(catalog.url).toBe("xbuild://dsh-builtin");
    expect(catalog.entries.length).toBeGreaterThan(0);
    for (const entry of catalog.entries) {
      // 内置只代表来源可核验，不能宣称功能已验证。
      expect(entry.compatibility).toBe("unverified");
      expect(entry.source.kind).toBe("npm");
      expect(entry.packageName).toBeTruthy();
    }
  });

  it("pins an exact version when the curated entry declares one", () => {
    const catalog = buildBuiltinCatalog();
    const aqua = catalog.entries.find((entry) => entry.packageName === "dsh-client-ui-aqua-unofficial");
    expect(aqua?.source).toMatchObject({ kind: "npm", spec: "dsh-client-ui-aqua-unofficial@1.4.1" });
  });
});
