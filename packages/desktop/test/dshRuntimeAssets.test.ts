import { existsSync, mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stageDshRuntimeDistribution } from "../scripts/dsh-runtime-assets.mjs";
import { dshNodeDownloadUrl, stageDshNodeExecutable } from "../scripts/dsh-node-assets.mjs";

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
  // v3.18.6 macOS arm64 CI 实测：cordis ↔ cordis-plugin-include 互为 peer，旧逻辑给
  // 双方都建 node_modules 链接，electron-builder 的文件遍历逐层跟随这个环，路径重复
  // 累积直到 ENAMETOOLONG。链接只能建在“向上解析找不到”的方向上，环必须被打破。
  it("never creates a link cycle between mutually-peered packages", async () => {
    const root = await makeRoot();
    await writePackage(root, "apps/zcode-cli/packages/dsh-runtime", { "@deepseek-ai/cordis": "1.0.0" });
    await mkdir(join(root, "apps/zcode-cli/packages/dsh-runtime/dist"), { recursive: true });
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/index.js"), "export {}\n");
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/worker.js"), "export {}\n");
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/worker-entry.js"), "export {}\n");
    await writePackage(root, "node_modules/@deepseek-ai/cordis");
    await writeFile(
      join(root, "node_modules/@deepseek-ai/cordis/package.json"),
      JSON.stringify({
        name: "@deepseek-ai/cordis",
        version: "1.0.0",
        peerDependencies: { "@deepseek-ai/cordis-plugin-include": "1.0.0" },
      }),
    );
    await writePackage(root, "node_modules/@deepseek-ai/cordis-plugin-include");
    await writeFile(
      join(root, "node_modules/@deepseek-ai/cordis-plugin-include/package.json"),
      JSON.stringify({
        name: "@deepseek-ai/cordis-plugin-include",
        version: "1.0.0",
        peerDependencies: { "@deepseek-ai/cordis": "1.0.0" },
      }),
    );
    await writePackage(root, "node_modules/pnpm");
    await writeFile(join(root, "node_modules/pnpm/package.json"), JSON.stringify({ name: "pnpm", version: "10.33.2" }));
    await mkdir(join(root, "node_modules/pnpm/bin"), { recursive: true });
    await writeFile(join(root, "node_modules/pnpm/bin/pnpm.cjs"), "// test\n");
    const node = join(root, "node");
    await writeFile(node, "not executed by this structural regression");

    const { targetRoot } = stageDshRuntimeDistribution({
      repoRoot: root,
      glmDir: join(root, "glm"),
      platformKey: "darwin-arm64",
      nodeExecutable: node,
      log: () => {},
    });

    const stagedCordis = join(targetRoot, "node_modules/@deepseek-ai/cordis");
    const stagedInclude = join(targetRoot, "node_modules/@deepseek-ai/cordis-plugin-include");
    expect(existsSync(stagedCordis)).toBe(true);
    expect(existsSync(stagedInclude)).toBe(true);
    // cordis 先入 pending，此时 include 还没暂存，这个方向的链接保留。
    expect(existsSync(join(stagedCordis, "node_modules", "@deepseek-ai", "cordis-plugin-include"))).toBe(true);
    // 反方向已被向上解析覆盖，绝不能再建链，否则链接图成环。
    expect(existsSync(join(stagedInclude, "node_modules", "@deepseek-ai", "cordis"))).toBe(false);

    // 以“链接所属包的规范目录 → 链接目标规范目录”为边做全图环检测。
    const linksFrom = new Map<string, Set<string>>();
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isSymbolicLink()) {
          const ownerIndex = dir.lastIndexOf(`${sep}node_modules${sep}`);
          const owner = realpathSync(ownerIndex >= 0 ? dir.slice(0, ownerIndex) : dir);
          if (!linksFrom.has(owner)) linksFrom.set(owner, new Set());
          linksFrom.get(owner)!.add(realpathSync(full));
        } else if (entry.isDirectory()) {
          walk(full);
        }
      }
    };
    walk(targetRoot);
    let cycles = 0;
    const visit = (dir: string, hops: number, visiting: Set<string>): void => {
      const outgoing = linksFrom.get(dir);
      if (!outgoing) return;
      for (const target of outgoing) {
        if (visiting.has(target) || hops > 1000) {
          cycles += 1;
          continue;
        }
        visiting.add(target);
        visit(target, hops + 1, visiting);
        visiting.delete(target);
      }
    };
    for (const [dir] of linksFrom) visit(dir, 0, new Set([dir]));
    expect(cycles).toBe(0);
  });

  // v3.18.7 包体审计实测：暂存树带着全部平台的原生二进制（5 份 libreoffice-kit、
  // 全平台 sherpa-onnx / sharp / ripgrep），zip 突破 500MiB。目标平台分发只能带
  // 目标平台的那一份；同前缀的非平台包装器（sherpa-onnx-node）和 wasm 软回退
  // 必须保留；父包目录里照搬进来的嵌套其他平台变体也要在整树清掉。
  it("stages only the target platform's native binaries", async () => {
    const root = await makeRoot();
    await writePackage(root, "apps/zcode-cli/packages/dsh-runtime", {
      "@deepseek-ai/libreoffice-kit": "1.0.0",
      "@deepseek-ai/dsh-speech": "1.0.0",
    });
    await mkdir(join(root, "apps/zcode-cli/packages/dsh-runtime/dist"), { recursive: true });
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/index.js"), "export {}\n");
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/worker.js"), "export {}\n");
    await writeFile(join(root, "apps/zcode-cli/packages/dsh-runtime/dist/worker-entry.js"), "export {}\n");
    await writePackage(root, "node_modules/@deepseek-ai/libreoffice-kit");
    await writeFile(
      join(root, "node_modules/@deepseek-ai/libreoffice-kit/package.json"),
      JSON.stringify({
        name: "@deepseek-ai/libreoffice-kit",
        version: "1.0.0",
        optionalDependencies: {
          "@deepseek-ai/libreoffice-kit-darwin-arm64": "1.0.0",
          "@deepseek-ai/libreoffice-kit-darwin-x64": "1.0.0",
          "@deepseek-ai/libreoffice-kit-wasm": "1.0.0",
        },
      }),
    );
    // 源安装里 libreoffice-kit 自带嵌套 node_modules（照搬路径），里面同时有
    // 其他平台变体与目标平台变体：前者要被整树清理，后者必须留下。
    await mkdir(join(root, "node_modules/@deepseek-ai/libreoffice-kit/node_modules/@img/sharp-win32-x64"), { recursive: true });
    await writeFile(
      join(root, "node_modules/@deepseek-ai/libreoffice-kit/node_modules/@img/sharp-win32-x64/package.json"),
      JSON.stringify({ name: "@img/sharp-win32-x64", version: "1.0.0" }),
    );
    await mkdir(join(root, "node_modules/@deepseek-ai/libreoffice-kit/node_modules/@img/sharp-darwin-arm64"), { recursive: true });
    await writeFile(
      join(root, "node_modules/@deepseek-ai/libreoffice-kit/node_modules/@img/sharp-darwin-arm64/package.json"),
      JSON.stringify({ name: "@img/sharp-darwin-arm64", version: "1.0.0" }),
    );
    // libvips 前缀与 @img/sharp- 重叠，必须命中自己的家族而不是被吃掉。
    await mkdir(join(root, "node_modules/@deepseek-ai/libreoffice-kit/node_modules/@img/sharp-libvips-darwin-x64"), { recursive: true });
    await writeFile(
      join(root, "node_modules/@deepseek-ai/libreoffice-kit/node_modules/@img/sharp-libvips-darwin-x64/package.json"),
      JSON.stringify({ name: "@img/sharp-libvips-darwin-x64", version: "1.0.0" }),
    );
    for (const name of ["@deepseek-ai/libreoffice-kit-darwin-arm64", "@deepseek-ai/libreoffice-kit-darwin-x64", "@deepseek-ai/libreoffice-kit-wasm"]) {
      await writePackage(root, `node_modules/${name}`);
    }
    await writePackage(root, "node_modules/@deepseek-ai/dsh-speech", { "sherpa-onnx-node": "1.0.0" }, { "sherpa-onnx-darwin-x64": "1.0.0" });
    await writePackage(root, "node_modules/sherpa-onnx-node");
    await writePackage(root, "node_modules/sherpa-onnx-darwin-x64");
    await writePackage(root, "node_modules/pnpm");
    await writeFile(join(root, "node_modules/pnpm/package.json"), JSON.stringify({ name: "pnpm", version: "10.33.2" }));
    await mkdir(join(root, "node_modules/pnpm/bin"), { recursive: true });
    await writeFile(join(root, "node_modules/pnpm/bin/pnpm.cjs"), "// test\n");
    const node = join(root, "node");
    await writeFile(node, "not executed by this structural regression");

    const logs: string[] = [];
    const { targetRoot } = stageDshRuntimeDistribution({
      repoRoot: root,
      glmDir: join(root, "glm"),
      platformKey: "darwin-arm64",
      nodeExecutable: node,
      log: (line) => logs.push(line),
    });

    const staged = (relativePath: string) => existsSync(join(targetRoot, "node_modules", relativePath));
    expect(staged("@deepseek-ai/libreoffice-kit-darwin-arm64")).toBe(true);
    // darwin-arm64 有原生引擎，wasm 软回退是死重，不进分发。
    expect(staged("@deepseek-ai/libreoffice-kit-wasm")).toBe(false);
    expect(staged("@deepseek-ai/libreoffice-kit-darwin-x64")).toBe(false);
    expect(staged("sherpa-onnx-node")).toBe(true);
    expect(staged("sherpa-onnx-darwin-x64")).toBe(false);
    // 嵌套照搬的变体：目标平台保留，其他平台清掉（含 libvips 这种前缀重叠家族）。
    expect(staged("@deepseek-ai/libreoffice-kit/node_modules/@img/sharp-darwin-arm64")).toBe(true);
    expect(staged("@deepseek-ai/libreoffice-kit/node_modules/@img/sharp-win32-x64")).toBe(false);
    expect(staged("@deepseek-ai/libreoffice-kit/node_modules/@img/sharp-libvips-darwin-x64")).toBe(false);
    expect(logs.join("\n")).toContain("foreign-platform native packages");
  });

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

describe("DSH node executable staging", () => {
  // CI 实测：解压后 mkdir 报 ENOTDIR，因为目录名把 .tar.xz 也算进去了，
  // 与同在 cacheDir 下的归档文件撞名。归档与解压目录必须不同名。
  it("extracts beside the archive, never onto its name", async () => {
    const cacheDir = await makeRoot();
    const seen: { archivePath: string; extractDir: string }[] = [];
    const executable = await stageDshNodeExecutable({
      cacheDir,
      platformKey: "darwin-x64",
      download: async (_url: string, target: string) => {
        await writeFile(target, "archive");
      },
      extract: ({ archivePath, extractDir }: { archivePath: string; extractDir: string }) => {
        seen.push({ archivePath, extractDir });
        const inner = join(extractDir, "node-v24.15.0-darwin-x64", "bin");
        mkdirSync(inner, { recursive: true });
        writeFileSync(join(inner, "node"), "node");
      },
      verifyArchive: () => {},
    });

    expect(seen).toHaveLength(1);
    const [call] = seen;
    expect(call.extractDir).not.toBe(call.archivePath);
    expect(call.extractDir.startsWith(call.archivePath)).toBe(false);
    expect(call.archivePath.endsWith(".tar.xz")).toBe(true);
    expect(existsSync(call.archivePath)).toBe(true);
    expect(existsSync(call.extractDir)).toBe(true);
    // 官方归档自带一层顶层目录，可执行文件在它下面的 bin/ 里。
    expect(executable).toBe(join(call.extractDir, "node-v24.15.0-darwin-x64", "bin", "node"));
  });

  // Windows ZIP 把 node.exe 直接放在顶层目录里，没有 POSIX 的 bin/。
  it("finds node.exe in the archive's own top directory on win32", async () => {
    const cacheDir = await makeRoot();
    const executable = await stageDshNodeExecutable({
      cacheDir,
      platformKey: "win32-x64",
      download: async (_url: string, target: string) => {
        await writeFile(target, "archive");
      },
      extract: ({ extractDir }: { extractDir: string }) => {
        const inner = join(extractDir, "node-v24.15.0-win-x64");
        mkdirSync(inner, { recursive: true });
        writeFileSync(join(inner, "node.exe"), "node");
      },
      verifyArchive: () => {},
    });
    expect(executable.endsWith(join("node-v24.15.0-win-x64", "node.exe"))).toBe(true);
    expect(existsSync(executable)).toBe(true);
  });

  // v3.18.6 曾把 Windows 失败误诊为“Expand-Archive 解出两层同名目录”；真实根因是
  // runner 的 PSModulePath 让 powershell.exe 装载 PowerShell 7 版 Archive 模块，
  // Expand-Archive 一个文件都没解出来（见 prebuilt-binary-extract.mjs）。这里保留
  // 递归兜底的行为回归：无论解压器嵌套多少层同名目录，都要找到 node.exe。
  it("finds node.exe under a doubly nested layout", async () => {
    const cacheDir = await makeRoot();
    const executable = await stageDshNodeExecutable({
      cacheDir,
      platformKey: "win32-x64",
      download: async (_url: string, target: string) => {
        await writeFile(target, "archive");
      },
      extract: ({ extractDir }: { extractDir: string }) => {
        const nested = join(extractDir, "node-v24.15.0-win-x64", "node-v24.15.0-win-x64");
        mkdirSync(nested, { recursive: true });
        writeFileSync(join(nested, "node.exe"), "node");
      },
      verifyArchive: () => {},
    });
    expect(executable.endsWith("node.exe")).toBe(true);
    expect(existsSync(executable)).toBe(true);
  });
});
