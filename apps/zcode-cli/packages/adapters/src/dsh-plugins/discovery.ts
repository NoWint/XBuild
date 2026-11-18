import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { DshPackageManifest, DshPackageSource } from "./contract.js";
import { parseDshManifest } from "./manifest.js";
import { DshPackageError } from "./errors.js";

/**
 * 本机已安装 DSH 插件的探测结果。
 *
 * 用途：用户机器上往往已经装过 DeepSeek Harness 与若干社区插件。XBuild 应当直接发现它们、
 * 展示原始身份并支持一键导入，而不是要求用户重新下载或手工抄包名。
 *
 * 这里只做**只读**发现：读取标准 DSH home 布局下的 profile 清单与实际包目录，
 * 用与安装路径相同的 parseDshManifest 校验，因此"能被发现"与"能被安装"共用同一套规则。
 * 不执行任何安装脚本、不修改用户已有的 DSH 数据。
 */
export interface DshDetectedProfile {
  /** profile 名（如 desktop / web）。 */
  name: string;
  /** profile 目录绝对路径。 */
  directory: string;
  /** profile 声明的 bundle 顺序，用于保留原有组合关系。 */
  bundles: string[];
}

export interface DshDetectedPlugin {
  packageName: string;
  version: string;
  /** 解析后的原始 manifest（含 entry / clientEntry / bundle patches）。 */
  manifest: DshPackageManifest;
  /** 提供该包的 profile 名；同一包被多个 profile 引用时按首次出现记录。 */
  profile: string;
  /** 包目录绝对路径，用于以本地目录作为安装来源。 */
  directory: string;
  /** 可直接交给 prepare 的本地来源。 */
  source: DshPackageSource;
  /** 是否为第三方包（非 @deepseek-ai 官方 scope）。 */
  thirdParty: boolean;
}

export interface DshLocalDiscovery {
  /** 实际扫描过的 DSH home（默认 ~/.dsh，可用环境变量覆盖）。 */
  home: string;
  profiles: DshDetectedProfile[];
  plugins: DshDetectedPlugin[];
  /** 无法解析的条目保留为诊断，不静默丢弃。 */
  diagnostics: Array<{ subject: string; message: string }>;
}

export interface DshLocalDiscoveryOptions {
  /** 覆盖 DSH home；默认取 DSH_HOME，其次 ~/.dsh。 */
  home?: string;
  /** 覆盖 home 解析（测试注入用）。 */
  homeProvider?: () => string | undefined;
  signal?: AbortSignal;
  /** 单个目录最多扫描的包数量，防止异常目录导致无界遍历。 */
  maxPackages?: number;
}

const DEFAULT_MAX_PACKAGES = 2000;

function resolveDshHome(options: DshLocalDiscoveryOptions): string {
  const explicit = options.home ?? options.homeProvider?.() ?? process.env.DSH_HOME;
  return explicit && explicit.trim() ? explicit : join(homedir(), ".dsh");
}

function isThirdParty(name: string): boolean {
  return !name.startsWith("@deepseek-ai/");
}

/** 读取 profile 的 package.json；缺失或损坏不作为致命错误，只记录诊断。 */
async function readProfileManifest(
  directory: string,
): Promise<{ name?: string; bundles: string[] } | undefined> {
  const raw = await readFile(join(directory, "package.json"), "utf8");
  const parsed = JSON.parse(raw) as {
    name?: unknown;
    dsh?: { profile?: { bundles?: unknown } };
  };
  const bundles = parsed.dsh?.profile?.bundles;
  return {
    ...(typeof parsed.name === "string" ? { name: parsed.name } : {}),
    bundles: Array.isArray(bundles)
      ? bundles.filter((item): item is string => typeof item === "string")
      : [],
  };
}

/**
 * 把 profile 下的 node_modules 条目解析成真实目录。
 * pnpm 的 link:/file: 依赖是软链，必须解析到真实路径，否则读不到 package.json。
 */
async function resolvePackageDirectory(root: string, entryName: string): Promise<string | undefined> {
  const candidate = join(root, entryName);
  try {
    if (!(await stat(candidate)).isDirectory()) return undefined;
    return await realpath(candidate);
  } catch (error) {
    // 失效软链（link: 依赖的源目录被删/移动）是真实状态，必须作为诊断暴露而不是静默跳过。
    const reason = (error as NodeJS.ErrnoException).code === "ENOENT" ? "broken link or missing directory" : String((error as Error).message);
    throw new Error(`${entryName}: ${reason}`);
  }
}

export async function discoverLocalDsh(
  options: DshLocalDiscoveryOptions = {},
): Promise<DshLocalDiscovery> {
  const home = resolveDshHome(options);
  const maxPackages = options.maxPackages ?? DEFAULT_MAX_PACKAGES;
  const diagnostics: DshLocalDiscovery["diagnostics"] = [];
  const profiles: DshDetectedProfile[] = [];
  const plugins: DshDetectedPlugin[] = [];
  const seenPackages = new Set<string>();
  let scanned = 0;

  const profilesRoot = join(home, "profiles");
  let profileEntries: string[];
  try {
    profileEntries = await readdir(profilesRoot);
  } catch (error) {
    // 没有 DSH home 是正常状态（用户没装过 DSH），不是错误。
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { home, profiles, plugins, diagnostics };
    }
    throw new DshPackageError("DSH_INVALID_METADATA", "Cannot read the local DSH home", {
      cause: error,
    });
  }

  for (const profileName of profileEntries.sort()) {
    options.signal?.throwIfAborted();
    if (profileName.startsWith(".") || profileName === "node_modules") continue;
    const directory = join(profilesRoot, profileName);
    let declaration: { bundles: string[] } | undefined;
    try {
      if (!(await stat(directory)).isDirectory()) continue;
      declaration = await readProfileManifest(directory);
      profiles.push({ name: profileName, directory, bundles: declaration?.bundles ?? [] });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      diagnostics.push({ subject: profileName, message: String((error as Error).message ?? error) });
      continue;
    }

    const nodeModules = join(directory, "node_modules");
    let entries: string[];
    try {
      entries = await readdir(nodeModules);
    } catch {
      continue;
    }
    // @scope 目录要再展开一层，否则社区包（多为 scoped）会被漏掉。
    const candidates: string[] = [];
    for (const entry of entries.sort()) {
      if (entry.startsWith(".")) continue;
      if (entry.startsWith("@")) {
        try {
          for (const inner of (await readdir(join(nodeModules, entry))).sort()) {
            candidates.push(`${entry}/${inner}`);
          }
        } catch {
          continue;
        }
        continue;
      }
      candidates.push(entry);
    }

    for (const candidate of candidates) {
      options.signal?.throwIfAborted();
      if (scanned >= maxPackages) {
        diagnostics.push({ subject: profileName, message: "Package scan limit reached" });
        break;
      }
      // 只关心插件：官方 DSH 内部包同样会被识别，但官方包是运行时依赖而不是用户插件，
      // 因此跳过 @deepseek-ai scope，避免把运行库自身当成可安装插件。
      if (candidate.startsWith("@deepseek-ai/")) continue;
      if (seenPackages.has(candidate)) continue;
      scanned += 1;
      let realDirectory: string | undefined;
      try {
        realDirectory = await resolvePackageDirectory(nodeModules, candidate);
      } catch (error) {
        diagnostics.push({ subject: candidate, message: String((error as Error).message) });
        continue;
      }
      if (!realDirectory) continue;
      try {
        const raw = JSON.parse(await readFile(join(realDirectory, "package.json"), "utf8"));
        const manifest = parseDshManifest(raw);
        if (manifest.name !== candidate) {
          diagnostics.push({
            subject: candidate,
            message: `Manifest name mismatch: ${manifest.name}`,
          });
          continue;
        }
        // 只把"确实是插件"的包列出来：声明了 dsh.bundle / dsh.profile / dsh.client，
        // 或出现在 profile 的 bundles 列表里。纯运行时依赖（如 @standard-schema/spec）
        // 虽然也带入口，但不是用户可安装/启用的插件，列出来会误导用户。
        const declaredAsBundle = declaration?.bundles.includes(manifest.name) ?? false;
        const hasDshCapability =
          manifest.bundlePatches.length > 0 ||
          manifest.profileBundles.length > 0 ||
          manifest.clientEntry !== undefined;
        if (!declaredAsBundle && !hasDshCapability) continue;
        seenPackages.add(candidate);
        plugins.push({
          packageName: manifest.name,
          version: manifest.version,
          manifest,
          profile: profileName,
          directory: realDirectory,
          // 本地目录来源保留原始包字节，不重新打包。
          source: { kind: "directory", spec: `file:${realDirectory}`, path: realDirectory },
          thirdParty: isThirdParty(manifest.name),
        });
      } catch (error) {
        diagnostics.push({
          subject: candidate,
          message: String((error as Error).message ?? error),
        });
      }
    }
  }

  return { home, profiles, plugins, diagnostics };
}
