import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export const DSH_RUNTIME_SOURCE_RELATIVE = "apps/zcode-cli/packages/dsh-runtime";
export const DSH_RUNTIME_STAGED_DIRECTORY = "dsh-runtime";

function readManifest(packageJsonPath) {
  return JSON.parse(readFileSync(packageJsonPath, "utf8"));
}

function isInside(root, target) {
  const local = relative(root, target);
  return local !== ".." && !local.startsWith("../") && !isAbsolute(local);
}

/**
 * 模拟 Node 的向上解析，判断依赖是否已在暂存树里可解析。
 *
 * 暂存目录镜像源安装的相对布局，依赖的规范位置一定落在目标目录的祖先链上，
 * 所以 node_modules 内部的互指链接（cordis ↔ cordis-plugin-include 这类 peer 环）
 * 全是冗余的；而 electron-builder 的文件遍历会逐层跟随这些链接，直到路径超过
 * PATH_MAX 直接 ENAMETOOLONG（v3.18.6 macOS arm64 CI 实测）。Node 本身按 realpath
 * 解析不会死循环，但打包器不会——凡向上已可解析就不再建链。
 */
function isResolvableInStagedTree(targetRoot, fromDirectory, packageName) {
  let directory = fromDirectory;
  while (isInside(targetRoot, directory)) {
    if (existsSync(join(directory, "node_modules", ...packageName.split("/")))) return true;
    const parent = dirname(directory);
    if (parent === directory) return false;
    directory = parent;
  }
  return false;
}

/**
 * Node's package-directory lookup is intentionally independent of package.json exports.
 * DSH's peer graph includes packages without a main entry or a public ./package.json export;
 * require.resolve would discard those packages and leave a runtime that only fails at boot.
 */
function resolveInstalledPackageJson(startDirectory, packageName) {
  let directory = startDirectory;
  for (;;) {
    const candidate = join(directory, "node_modules", ...packageName.split("/"), "package.json");
    if (existsSync(candidate)) return realpathSync(candidate);
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function isOptional(manifest, name) {
  return Boolean(
    manifest.optionalDependencies?.[name] || manifest.peerDependenciesMeta?.[name]?.optional,
  );
}

/**
 * Stage the runtime and its *actually installed* dependency graph as a self-contained directory.
 *
 * This deliberately does not invoke a package manager. The launcher requires an offline,
 * byte-preserving distribution with a pinned runtime; a second install can choose different
 * transitive versions and cannot reproduce the lockfile used to build the Agent.
 *
 * Existing package directories and links are retained. Links added for hoisted dependencies
 * are relative, so moving the staged directory cannot leak back into the source checkout.
 */
export function stageDshRuntimeDistribution({
  repoRoot,
  glmDir,
  platformKey,
  nodeExecutable,
  log = console.log,
}) {
  const sourceRoot = realpathSync(resolve(repoRoot, DSH_RUNTIME_SOURCE_RELATIVE));
  const canonicalRepoRoot = realpathSync(repoRoot);
  const targetRoot = resolve(glmDir, DSH_RUNTIME_STAGED_DIRECTORY);
  if (!existsSync(resolve(sourceRoot, "dist", "index.js"))) {
    throw new Error(`[stage:dsh-runtime] runtime dist is missing: ${sourceRoot}/dist/index.js`);
  }
  if (!nodeExecutable || !isAbsolute(nodeExecutable) || !existsSync(nodeExecutable)) {
    throw new Error(`[stage:dsh-runtime] a real standalone Node executable is required for pnpm`);
  }
  if (!["darwin-arm64", "darwin-x64", "win32-arm64", "win32-x64", "linux-arm64", "linux-x64"].includes(platformKey)) {
    throw new Error(`[stage:dsh-runtime] unsupported staged platform: ${platformKey}`);
  }
  const stagedNode = resolve(targetRoot, "bin", platformKey.startsWith("win32") ? "node.exe" : "node");
  rmSync(targetRoot, { recursive: true, force: true });
  mkdirSync(targetRoot, { recursive: true });
  for (const entry of ["package.json", "dist"]) {
    cpSync(resolve(sourceRoot, entry), resolve(targetRoot, entry), { recursive: true });
  }
  mkdirSync(dirname(stagedNode), { recursive: true });
  copyFileSync(nodeExecutable, stagedNode);
  if (!platformKey.startsWith("win32")) {
    // Node 归档或 CI 提供的路径可能没有保留可执行位；复制时必须恢复。
    chmodSync(stagedNode, 0o755);
  }

  const pending = [
    resolve(sourceRoot, "package.json"),
    resolveInstalledPackageJson(canonicalRepoRoot, "pnpm"),
  ];
  const copied = new Set();
  let optionalSkipped = 0;
  while (pending.length) {
    const sourcePackageJson = realpathSync(pending.shift());
    if (copied.has(sourcePackageJson)) continue;
    const sourceDirectory = dirname(sourcePackageJson);
    if (!isInside(canonicalRepoRoot, sourceDirectory)) {
      throw new Error(`[stage:dsh-runtime] dependency escapes the checkout: ${sourceDirectory}`);
    }
    copied.add(sourcePackageJson);
    const targetDirectory = resolve(targetRoot, relative(canonicalRepoRoot, sourceDirectory));
    if (!isInside(targetRoot, targetDirectory)) {
      throw new Error(`[stage:dsh-runtime] invalid staged dependency path: ${targetDirectory}`);
    }
    cpSync(sourceDirectory, targetDirectory, { recursive: true, verbatimSymlinks: true });

    const manifest = readManifest(sourcePackageJson);
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.peerDependencies,
      ...manifest.optionalDependencies,
    };
    for (const packageName of Object.keys(dependencies)) {
      const existing = resolve(sourceDirectory, "node_modules", ...packageName.split("/"));
      if (existsSync(existing)) {
        // Existing real directories and symlinks were copied as-is. Follow the real target
        // to include its own dependencies, rather than replacing it with a root version.
        pending.push(resolve(realpathSync(existing), "package.json"));
        continue;
      }
      const dependencyPackageJson = resolveInstalledPackageJson(sourceDirectory, packageName);
      if (!dependencyPackageJson) {
        if (isOptional(manifest, packageName)) {
          optionalSkipped += 1;
          continue;
        }
        throw new Error(
          `[stage:dsh-runtime] required dependency ${packageName} is missing from ${sourceDirectory}`,
        );
      }
      const dependencyTarget = resolve(targetRoot, relative(canonicalRepoRoot, dirname(dependencyPackageJson)));
      if (!isResolvableInStagedTree(targetRoot, targetDirectory, packageName)) {
        const link = resolve(targetDirectory, "node_modules", ...packageName.split("/"));
        mkdirSync(dirname(link), { recursive: true });
        symlinkSync(relative(dirname(link), dependencyTarget), link, "dir");
      }
      pending.push(dependencyPackageJson);
    }
  }
  const pnpmManifest = readManifest(resolve(targetRoot, "node_modules", "pnpm", "package.json"));
  if (pnpmManifest.name !== "pnpm" || pnpmManifest.version !== "10.33.2") {
    throw new Error(`[stage:dsh-runtime] expected pinned pnpm 10.33.2`);
  }
  for (const entry of [
    "package.json",
    "dist/index.js",
    "dist/worker.js",
    "dist/worker-entry.js",
    "node_modules/pnpm/package.json",
    "node_modules/pnpm/bin/pnpm.cjs",
    relative(targetRoot, stagedNode),
  ]) {
    if (!existsSync(resolve(targetRoot, entry))) {
      throw new Error(`[stage:dsh-runtime] staged asset is missing: ${entry}`);
    }
  }
  log(
    `[stage:dsh-runtime] staged ${copied.size} installed packages for ${platformKey}` +
      (optionalSkipped ? ` (${optionalSkipped} unavailable optional packages skipped)` : ""),
  );
  return { targetRoot, stagedNode, packageCount: copied.size };
}
