import { mkdtemp, mkdir, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stageDshRuntimeDistribution } from "../scripts/dsh-runtime-assets.mjs";
import { dshNodeDownloadUrl } from "../scripts/dsh-node-assets.mjs";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dsh-runtime-stage-"));
  roots.push(root);
  return root;
}

async function writePackage(root: string, relativePath: string, dependencies = {}, optionalDependencies = {}) {
  const directory = join(root, relativePath);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "package.json"), JSON.stringify({
    name: relativePath.split("/").at(-1),
    version: "1.0.0",
    ...(Object.keys(dependencies).length ? { dependencies } : {}),
    ...(Object.keys(optionalDependencies).length ? { optionalDependencies } : {}),
  }));
}

describe("DSH staged runtime distribution", () => {
  it("preserves installed peer resolution and emits only relative staged links", async () => {
    const root = await makeRoot();
    await writePackage(root, "apps/zcode-cli/packages/dsh-runtime", { "@deepseek-ai/dsh-app-boot": "1.0.0" });
    await mkdir(join(root, "apps/zcode-cli/packages/dsh-runtime/dist"), { recursive: true });
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/index.js"), "export {}\n");
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/worker.js"), "export {}\n");
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/worker-entry.js"), "export {}\n");
    await writePackage(root, "node_modules/@deepseek-ai/dsh-app-boot", { "@deepseek-ai/cordis-plugin-group": "1.0.0" });
    await writePackage(root, "node_modules/@deepseek-ai/cordis-plugin-group");
    await writePackage(root, "node_modules/pnpm", { "package-without-main": "1.0.0" });
    await writeFile(join(root, "node_modules/pnpm/package.json"), JSON.stringify({ name: "pnpm", version: "10.33.2", dependencies: { "package-without-main": "1.0.0" } }));
    await mkdir(join(root, "node_modules/pnpm/bin"), { recursive: true });
    await writeFile(join(root, "node_modules/pnpm/bin/pnpm.cjs"), "// test\n");
    await writePackage(root, "node_modules/package-without-main", {}, { "not-installed-optional": "1.0.0" });

    const node = join(root, "node");
    await writeFile(node, "not executed by this structural regression");
    const { targetRoot, packageCount } = stageDshRuntimeDistribution({
      repoRoot: root,
      glmDir: join(root, "glm"),
      platformKey: "darwin-arm64",
      nodeExecutable: node,
      log: () => {},
    });
    expect(packageCount).toBe(5);
    // peerDependencies 未在 dependencies 出现时也必须进入分发，否则 boot 才报缺包。
    const groupManifest = await readFile(join(targetRoot, "node_modules/@deepseek-ai/cordis-plugin-group/package.json"), "utf8");
    expect(JSON.parse(groupManifest).name).toBe("cordis-plugin-group");
    const pnpmLink = join(targetRoot, "apps/zcode-cli/packages/dsh-runtime/node_modules/@deepseek-ai/dsh-app-boot");
    const linkTarget = await readlink(pnpmLink);
    expect(isAbsolute(linkTarget)).toBe(false);
    expect(linkTarget).not.toContain(root);
    expect(relative(targetRoot, join(pnpmLink, "..", linkTarget))).not.toMatch(/^\.\./);
    expect(dshNodeDownloadUrl("darwin-arm64")).toContain("node-v24.15.0-darwin-arm64.tar.xz");
  });

  it("fails instead of shipping an incomplete required dependency graph", async () => {
    const root = await makeRoot();
    await writePackage(root, "apps/zcode-cli/packages/dsh-runtime", { "required-missing": "1.0.0" });
    await mkdir(join(root, "apps/zcode-cli/packages/dsh-runtime/dist"), { recursive: true });
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/index.js"), "export {}\n");
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/worker.js"), "export {}\n");
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/worker-entry.js"), "export {}\n");
    await writePackage(root, "node_modules/pnpm");
    await writeFile(join(root, "node"), "node");
    expect(() => stageDshRuntimeDistribution({
      repoRoot: root,
      glmDir: join(root, "glm"),
      platformKey: "darwin-arm64",
      nodeExecutable: join(root, "node"),
      log: () => {},
    })).toThrow(/required dependency required-missing/);
  });
});
