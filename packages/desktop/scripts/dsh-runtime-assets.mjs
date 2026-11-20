import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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
 * 已知的「每平台一份」原生二进制包家族。
 *
 * 这些包全部经 optionalDependencies 安装（pnpm hoisted 会把所有平台变体都装进
 * 源安装），加载器在运行时按 process.platform/arch 自行挑选；v3.18.7 的包体审计
 * 实测：一份 darwin-arm64 暂存树带着 5 个平台的 libreoffice-kit（约 835MB）和全部
 * 平台的 sherpa-onnx / sharp / ripgrep 变体，zip 直接突破 500MiB 预算。
 * targetAliases 处理家族命名与平台 key 的差异（如 sherpa 用 win-x64 而平台是 win32-x64）。
 * wasm/wasm32 后缀是加载器的软回退引擎，所有平台保留。
 */
const NATIVE_PACKAGE_FAMILIES = [
  {
    prefix: "@deepseek-ai/libreoffice-kit-",
    suffixes: ["darwin-arm64", "darwin-x64", "win32-arm64", "win32-x64", "linux-x64-glibc"],
    wasmFallback: true,
  },
  {
    // 注意顺序：libvips 必须排在 @img/sharp- 前面，前缀匹配取第一个命中，
    // 排在后面会被 @img/sharp- 家族吃掉而把 libvips-darwin-x64 这类后缀判成非平台包。
    prefix: "@img/sharp-libvips-",
    suffixes: ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "linuxmusl-arm64", "linuxmusl-x64", "win32-x64"],
  },
  {
    prefix: "@img/sharp-",
    suffixes: [
      "darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "linuxmusl-arm64", "linuxmusl-x64",
      "win32-ia32", "win32-arm64", "win32-x64", "freebsd-x64", "openbsd-x64",
    ],
    wasmFallback: true,
  },
  {
    prefix: "@vscode/ripgrep-",
    suffixes: ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-arm64", "win32-x64"],
  },
  {
    prefix: "sherpa-onnx-",
    suffixes: ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win-arm64", "win-x64"],
    targetAliases: { "win32-arm64": "win-arm64", "win32-x64": "win-x64" },
  },
  {
    prefix: "node-addon-require-builtin-",
    suffixes: [
      "darwin-arm64", "darwin-x64", "linux-arm64-gnu", "linux-arm64-musl", "linux-x64-gnu", "linux-x64-musl",
      "win32-arm64-msvc", "win32-x64-msvc",
    ],
  },
  {
    prefix: "@deepseek-ai/node-addon-system-",
    suffixes: ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-arm64", "win32-x64"],
  },
  {
    prefix: "@koromix/koffi-",
    suffixes: [
      "darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "linux-ia32", "linux-riscv64", "linux-loong64",
      "linux-musl-arm64", "linux-musl-x64", "freebsd-ia32", "freebsd-x64", "freebsd-arm64",
      "openbsd-ia32", "openbsd-x64", "win32-ia32", "win32-arm64", "win32-x64",
    ],
  },
];

/**
 * 判断一个包是否是「不属于目标平台」的原生二进制包；这类包在分发里是纯死重，
 * 见 NATIVE_PACKAGE_FAMILIES 注释。
 */
export function isForeignNativePackage(packageName, platformKey) {
  const family = NATIVE_PACKAGE_FAMILIES.find((candidate) => packageName.startsWith(candidate.prefix));
  if (!family) return false;
  const suffix = packageName.slice(family.prefix.length);
  const targetSuffix = family.targetAliases?.[platformKey] ?? platformKey;
  const targetHasNative = family.suffixes.includes(targetSuffix);
  if (family.wasmFallback && (suffix === "wasm" || suffix === "wasm32")) {
    // wasm 是加载器缺原生引擎时的软回退。发布目标全部有原生构建，wasm 是死重；
    // 只有目标平台没有原生构建（如未来加 linux-musl）时才保留 wasm 回退。
    return targetHasNative;
  }
  if (suffix === targetSuffix) return false;
  // 只有落在家族已知的平台后缀清单里才算平台变体；同前缀的非平台包
  // （如 JS 包装器 sherpa-onnx-node）必须原样保留。
  return family.suffixes.includes(suffix);
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
      // 其他平台的原生二进制不进分发。它们全部来自 optionalDependencies（加载器按
      // process.platform 挑选目标平台那一份）；若某个 manifest 竟然把它声明为必需
      // 依赖，宁可让打包失败也不静默裁剪。
      if (isForeignNativePackage(packageName, platformKey)) {
        if (!isOptional(manifest, packageName)) {
          throw new Error(
            `[stage:dsh-runtime] required dependency ${packageName} is foreign-platform native for ${platformKey} (from ${sourceDirectory})`,
          );
        }
        optionalSkipped += 1;
        continue;
      }
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
  // cpSync 是整目录照搬：源安装里若有包自带嵌套 node_modules 且其中含其他平台
  // 变体（v3.18.7 实测 cordis-plugin-loader 嵌套 node-addon-require-builtin 全平台），
  // 上面的依赖跳过拦不住，这里在整棵暂存树统一再清一遍。
  const prunedForeignNatives = pruneForeignNativePackages(targetRoot, platformKey);
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
      (optionalSkipped ? ` (${optionalSkipped} unavailable optional packages skipped)` : "") +
      (prunedForeignNatives ? ` (pruned ${prunedForeignNatives} foreign-platform native packages)` : ""),
  );
  return { targetRoot, stagedNode, packageCount: copied.size };
}

/** 清掉暂存树里所有 node_modules 层级上的其他平台原生包，返回删除数量。 */
function pruneForeignNativePackages(targetRoot, platformKey) {
  let pruned = 0;
  const pruneLevel = (nodeModulesDir) => {
    let entries;
    try {
      entries = readdirSync(nodeModulesDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("@")) {
        const scopeDir = join(nodeModulesDir, entry.name);
        let scopeEntries;
        try {
          scopeEntries = readdirSync(scopeDir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const child of scopeEntries) {
          if (!child.isDirectory()) continue;
          const packageName = `${entry.name}/${child.name}`;
          if (isForeignNativePackage(packageName, platformKey)) {
            rmSync(join(scopeDir, child.name), { recursive: true, force: true });
            pruned += 1;
          }
        }
        continue;
      }
      if (isForeignNativePackage(entry.name, platformKey)) {
        rmSync(join(nodeModulesDir, entry.name), { recursive: true, force: true });
        pruned += 1;
      }
    }
  };
  const visit = (directory) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules") {
        const level = join(directory, entry.name);
        pruneLevel(level);
        visit(level);
        continue;
      }
      visit(join(directory, entry.name));
    }
  };
  visit(targetRoot);
  return pruned;
}
