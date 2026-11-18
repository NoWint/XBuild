import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { isSea } from "node:sea";
import { pathToFileURL } from "node:url";
import {
  buildBuiltinCatalog,
  createDshCatalogStore,
  createDshHttpsRequest,
  createDshPackageCommand,
  createDshPackageStore,
  discoverLocalDsh,
} from "@zcode/adapters/dsh-plugins";
import type { DshController, DshDefaultControllerOptions, DshLauncherDistribution } from "./contract.js";
import { createDshController } from "./controller.js";
import { DshControllerError, scopeKey } from "./projection.js";

const DSH_VERSION = "0.2.2-rc.3";
const PNPM_VERSION = "10.33.2";

function unavailable(): DshControllerError {
  return new DshControllerError("DSH_DISTRIBUTION_UNAVAILABLE", "Trusted native plugin distribution assets are unavailable");
}

/**
 * 在开发检出里定位仓库根。
 *
 * 修复原因：dev 的 agent 实际执行的是 bundled-agents/<平台>/glm/zcode.cjs（由
 * build-desktop-agent-cli 暂存），该路径不含 /apps/zcode-cli/，于是 defaultDistribution()
 * 误走 staged 分支，把运行库根推导成 glm/dsh-runtime —— 那个目录从未被暂存，结果是
 * DSH 插件管理在 dev 里恒返回 DSH_DISTRIBUTION_UNAVAILABLE（UI 能开，装不了插件）。
 *
 * 这里只在确实存在仓库源码布局时返回仓库根；打包产物没有该布局，仍走 staged，
 * 不会把开发路径泄漏到生产判定里。
 */
function findDevelopmentRepoRoot(start: string): string | undefined {
  let current = dirname(start);
  for (let depth = 0; depth < 8; depth += 1) {
    if (
      existsSync(join(current, "pnpm-workspace.yaml")) &&
      existsSync(join(current, "apps", "zcode-cli", "packages", "bootstrap", "package.json"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
  return undefined;
}

function defaultDistribution(): DshLauncherDistribution {
  if (isSea()) return { kind: "staged", root: dirname(process.execPath), runner: { kind: "sea", executable: process.execPath } };
  // CJS bundle 没有 import.meta.url；资源身份来自正在执行的 CLI 文件，不从 cwd、用户 PATH 或前端参数猜测。
  const launcherAnchor = process.argv[1];
  if (!launcherAnchor || !isAbsolute(launcherAnchor)) throw unavailable();
  const root = join(dirname(launcherAnchor), "dsh-runtime");
  const electronRunner = process.versions.electron
    ? { kind: "electron-node" as const, executable: process.execPath, packageManagerExecutable: join(root, "bin", process.platform === "win32" ? "node.exe" : "node") }
    : { kind: "node" as const, executable: process.execPath };
  if (launcherAnchor.replaceAll("\\", "/").includes("/apps/zcode-cli/")) {
    // 修复原因：development 分支也不能用 electron-node runner。该 runner 需要
    // `<anchorDir>/dsh-runtime/bin/node`（随包分发的独立 node 二进制），检出里并不存在，
    // 结果为 ENOENT 并被上层归一化成 "distribution is unavailable"。
    // 检出内直接用当前进程的真实 Node 运行 worker 与 pnpm。
    return {
      kind: "development",
      launcherAnchor,
      runner: { kind: "node", executable: process.execPath },
    };
  }
  // dev 从暂存的 agent bundle 启动时，回落到检出内已构建的运行库；依赖闭包在仓库根，
  // 因此 trustedRoot 取仓库根，与 development 分支的既有语义一致。
  const repoRoot = findDevelopmentRepoRoot(launcherAnchor);
  if (repoRoot) {
    // 检出里没有随包分发的独立 node 二进制（electron-node runner 需要它来跑 pnpm），
    // 直接使用当前进程的真实 Node 作为 runner：dev 环境本就由 Node 启动 agent bundle。
    return {
      kind: "development",
      launcherAnchor: join(repoRoot, "apps", "zcode-cli", "packages", "bootstrap", "package.json"),
      runner: { kind: "node", executable: process.execPath },
    };
  }
  return { kind: "staged", root, runner: electronRunner };
}

async function manifest(path: string): Promise<{ name?: string; version?: string; dependencies?: Record<string, string> }> {
  if ((await stat(path)).size > 1024 * 1024) throw unavailable();
  return JSON.parse(await readFile(path, "utf8"));
}

async function requireFile(path: string, trustedRoot?: string): Promise<string> {
  if (!isAbsolute(path) || !(await stat(path)).isFile()) throw unavailable();
  const canonical = await realpath(path);
  if (trustedRoot) {
    const local = relative(trustedRoot, canonical);
    if (local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local)) throw unavailable();
  }
  return canonical;
}

async function runtimeInventory(installationAnchor: string, trustedRoot: string): Promise<Record<string, string>> {
  const anchorRequire = createRequire(installationAnchor);
  const inventory: Record<string, string> = {};
  const pending = [installationAnchor];
  const visited = new Set<string>();
  // 原生 boot 提供的 peer 不只在 runtime 直接依赖中；只沿已声明的 DSH/Cordis 闭包核实，不扫描 ambient 包。
  while (pending.length) {
    const owner = pending.pop()!;
    if (visited.has(owner)) continue;
    visited.add(owner);
    if (visited.size > 2048) throw unavailable();
    const dependencies = (await manifest(owner)).dependencies ?? {};
    const ownerRequire = createRequire(owner);
    for (const [name, declared] of Object.entries(dependencies)) {
      if (name !== "@deepseek-ai/cordis" && !name.startsWith("@deepseek-ai/dsh")) continue;
      const expected = name === "@deepseek-ai/cordis" ? "4.1.0" : DSH_VERSION;
      if (owner === installationAnchor && declared !== expected) throw unavailable();
      const dependencyAnchor = await requireFile(ownerRequire.resolve(`${name}/package.json`), trustedRoot);
      const installed = await manifest(dependencyAnchor);
      if (installed.name !== name || installed.version !== expected) throw unavailable();
      pending.push(dependencyAnchor);
      let exposed: string;
      try { exposed = anchorRequire.resolve(`${name}/package.json`); }
      catch { continue; }
      const visible = await manifest(await requireFile(exposed, trustedRoot));
      if (visible.name !== name || visible.version !== expected) throw unavailable();
      inventory[name] = expected;
    }
  }
  if (inventory["@deepseek-ai/dsh"] !== DSH_VERSION || inventory["@deepseek-ai/cordis"] !== "4.1.0") throw unavailable();
  return inventory;
}

export async function createDefaultDshController(options: DshDefaultControllerOptions): Promise<DshController> {
  try {
    if (!isAbsolute(options.cliStorageRoot)) throw unavailable();
    const distribution = options.distribution ?? defaultDistribution();
    if (distribution.runner.kind === "sea") throw unavailable();
    const executable = await requireFile(distribution.runner.executable);
    const packageExecutable = distribution.runner.kind === "electron-node"
      ? await requireFile(distribution.runner.packageManagerExecutable) : executable;
    const launcherRequire = distribution.kind === "development"
      ? createRequire(await requireFile(distribution.launcherAnchor)) : undefined;
    const sourceAnchor = distribution.kind === "development" ? (await realpath(distribution.launcherAnchor)).replaceAll("\\", "/") : "";
    const sourceMarker = sourceAnchor.indexOf("/apps/zcode-cli/");
    if (distribution.kind === "development" && sourceMarker < 0) throw unavailable();
    const trustedRoot = await realpath(distribution.kind === "staged" ? distribution.root : sourceAnchor.slice(0, sourceMarker));
    const installationAnchor = await requireFile(launcherRequire
      ? launcherRequire.resolve("@zcode/dsh-runtime/package.json") : join(distribution.kind === "staged" ? distribution.root : "", "package.json"), trustedRoot);
    const runtimeDependencyRoot = dirname(installationAnchor);
    const runtimeManifest = await manifest(installationAnchor);
    if (runtimeManifest.name !== "@zcode/dsh-runtime") throw unavailable();
    const runtimeVersions = await runtimeInventory(installationAnchor, trustedRoot);
    const runtimeEntry = await requireFile(join(runtimeDependencyRoot, "dist", "index.js"), trustedRoot);
    await requireFile(join(runtimeDependencyRoot, "dist", "worker.js"), trustedRoot);
    await requireFile(join(runtimeDependencyRoot, "dist", "worker-entry.js"), trustedRoot);
    const pnpmAnchor = await requireFile(launcherRequire
      ? launcherRequire.resolve("pnpm") : join(runtimeDependencyRoot, "node_modules", "pnpm", "package.json"), trustedRoot);
    const pnpm = await manifest(pnpmAnchor);
    if (pnpm.name !== "pnpm" || pnpm.version !== PNPM_VERSION) throw unavailable();
    const pnpmEntry = await requireFile(join(dirname(pnpmAnchor), "bin", "pnpm.cjs"), trustedRoot);
    const packageCommand = createDshPackageCommand({ executable: packageExecutable, prefixArgs: [pnpmEntry] });
    const httpsRequest = createDshHttpsRequest();
    // 通过已校验的公开 ESM entry 加载；CJS 打包不能把原生 worker 的 TLA 图内联进 CLI。
    const runtime: typeof import("@zcode/dsh-runtime") = await import(pathToFileURL(runtimeEntry).href);
    const root = join(options.cliStorageRoot, "dsh");
    return createDshController({
      packages: createDshPackageStore({ root: join(root, "inventory"), runtimeVersions, runtimeDependencyRoot, packageCommand, httpsRequest }),
      catalogs: (scope) => createDshCatalogStore({
        root: join(root, "catalogs", createHash("sha256").update(scopeKey(scope)).digest("hex")),
        httpsRequest,
        // 内置精选源随应用分发，用户首次打开即可浏览；远程源仍可自由添加。
        builtinCatalog: buildBuiltinCatalog,
      }),
      runtimeVersions, installationAnchor, startDomain: runtime.startDshDomain,
      runner: { executable },
      // 自动识别本机已装的 DSH 插件，用户不必重新下载；只读发现，不写入用户 DSH 数据。
      // 适配层只暴露安装/展示所需字段：来源由后端按 directory 重建，前端不参与路径推导。
      discoverLocal: async (input) => {
        const found = await discoverLocalDsh(input);
        return {
          home: found.home,
          profiles: found.profiles.map((profile) => ({
            name: profile.name,
            bundles: profile.bundles,
          })),
          plugins: found.plugins.map((plugin) => ({
            packageName: plugin.packageName,
            version: plugin.version,
            profile: plugin.profile,
            directory: plugin.directory,
            thirdParty: plugin.thirdParty,
            capabilities: [
              ...(plugin.manifest.bundlePatches.length ? ["bundle"] : []),
              ...(plugin.manifest.clientEntry ? ["client"] : []),
              ...(plugin.manifest.profileBundles.length ? ["profile"] : []),
              ...(plugin.manifest.entry ? ["entry"] : []),
            ],
            alreadyInstalled: false,
            ...(plugin.manifest.description ? { description: plugin.manifest.description } : {}),
            ...(plugin.manifest.author ? { author: plugin.manifest.author } : {}),
            ...(plugin.manifest.license ? { license: plugin.manifest.license } : {}),
          })),
          diagnostics: found.diagnostics,
        };
      },
      environment: distribution.runner.kind === "electron-node" ? { ELECTRON_RUN_AS_NODE: "1" } : {},
    });
  } catch (error) {
    if (error instanceof DshControllerError) throw error;
    // 修复原因：这里过去把所有异常统一换成 unavailable()，真实原因（缺文件、版本不符、
    // 路径逃逸、依赖解析失败）完全丢失，排查时只能看到 "distribution is unavailable"。
    // 保留原始原因到 stderr（仅供本地诊断；对外错误码与消息不变，不向前端泄露路径）。
    process.stderr.write(
      `[dsh] controller initialization failed: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}\n`,
    );
    throw unavailable();
  }
}
