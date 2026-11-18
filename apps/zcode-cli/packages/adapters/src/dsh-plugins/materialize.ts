import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import semver from "semver";
import type {
  DshData,
  DshHttpsRequest,
  DshPackageCommand,
  DshPackageManifest,
  DshPackageSource,
  DshPrepareInstallation,
} from "./contract.js";
import { copyPackage, inside, readJson, writeJson } from "./files.js";
import { objectValue, parseDshManifest } from "./manifest.js";
import { DSH_PACKAGE_NAME } from "./source.js";
import { DshPackageError } from "./errors.js";
import { createDshHttpsRequest, dshPublicHttpsUrl } from "./https.js";

export const DSH_HOST_OVERLAY_FILENAME = ".xbuild-host-overlay.json";

export interface MaterializeOptions {
  source: DshPackageSource;
  profileDirectory: string;
  input: DshPrepareInstallation;
  packageCommand?: DshPackageCommand;
  httpsRequest?: DshHttpsRequest;
  runtimeVersions: Readonly<Record<string, string>>;
  runtimeDependencyRoot?: string;
}

export async function materializeDshProfile(options: MaterializeOptions): Promise<{
  manifest: DshPackageManifest;
  dependencyInventory: Array<{ name: string; version: string; integrity?: string }>;
}> {
  const { source, profileDirectory, input, runtimeVersions, packageCommand } = options;
  await mkdir(profileDirectory, { recursive: true });
  await writeJson(join(profileDirectory, "package.json"), {
    name: "xbuild-dsh-domain",
    version: "0.0.0",
    private: true,
    type: "module",
  });
  let packageName: string;
  if (source.kind === "directory") {
    const candidate = parseDshManifest(await readJson(join(source.path, "package.json")));
    packageName = candidate.name;
    const destination = inside(join(profileDirectory, "node_modules"), packageName);
    await copyPackage(source.path, destination, input.signal);
    const dependencies = Object.entries(candidate.dependencies);
    const optionalDependencies =
      candidate.raw.optionalDependencies === undefined
        ? {}
        : objectValue(candidate.raw.optionalDependencies, "optionalDependencies");
    if (Object.values(optionalDependencies).some((value) => typeof value !== "string"))
      throw new Error("optionalDependencies values must be strings");
    if (dependencies.length || Object.keys(optionalDependencies).length) {
      if (!packageCommand)
        throw new Error("Package dependencies require the embedded package manager");
      await writeJson(join(profileDirectory, "package.json"), {
        name: "xbuild-dsh-domain",
        version: "0.0.0",
        private: true,
        type: "module",
        dependencies: Object.fromEntries(dependencies),
        // 本地副本不携带 node_modules；保留原始 optional 声明，交给 pnpm 处理平台和可选失败语义。
        ...(candidate.raw.optionalDependencies === undefined ? {} : { optionalDependencies }),
      });
      await install(packageCommand, [], profileDirectory, input.signal);
      await copyPackage(source.path, destination, input.signal);
    }
  } else {
    if (!packageCommand)
      throw new DshPackageError(
        "DSH_INSTALL_FAILED",
        "Package source requires the embedded package manager",
      );
    if (source.kind === "https") {
      const response = await (options.httpsRequest ?? createDshHttpsRequest()).request(
        dshPublicHttpsUrl(source.spec),
        { signal: input.signal, maxBytes: 128 * 1024 * 1024, timeoutMs: 120000 },
      );
      if (response.bytes.byteLength > 128 * 1024 * 1024)
        throw new DshPackageError("DSH_HTTP_FAILED", "Package archive exceeds byte limit");
      const [algorithm, expected] = source.integrity!.split("-");
      if (
        !algorithm ||
        createHash(algorithm).update(response.bytes).digest("base64") !== expected
      ) {
        throw new DshPackageError(
          "DSH_INTEGRITY_MISMATCH",
          "HTTPS package archive integrity mismatch",
        );
      }
      const archive = join(profileDirectory, ".xbuild-source.tgz");
      try {
        await writeFile(archive, response.bytes, { flag: "wx", mode: 0o600 });
        await install(packageCommand, [`file:${archive}`], profileDirectory, input.signal);
      } finally {
        await rm(archive, { force: true });
      }
    } else {
      await install(packageCommand, [source.spec], profileDirectory, input.signal);
    }
    const installed = objectValue(
      await readJson(join(profileDirectory, "package.json")),
      "installed profile",
    );
    const dependencies = objectValue(installed.dependencies, "installed dependencies");
    const names = Object.keys(dependencies);
    if (source.kind === "npm") {
      packageName = source.packageName;
      if (names.length !== 1 || names[0] !== packageName)
        throw new Error("Package manager installed an unexpected package");
    } else {
      if (names.length !== 1 || !names[0])
        throw new Error("Package source must install exactly one original package");
      packageName = names[0];
    }
  }
  if (!DSH_PACKAGE_NAME.test(packageName)) throw new Error("Invalid installed package identity");
  const packageDirectory = inside(join(profileDirectory, "node_modules"), packageName);
  const manifest = parseDshManifest(await readJson(join(packageDirectory, "package.json")));
  if (manifest.name !== packageName)
    throw new Error("Installed package identity does not match its declared name");
  if (source.kind === "npm") {
    const declaredVersion = source.spec.slice(source.packageName.length + 1);
    if (semver.valid(declaredVersion) && manifest.version !== declaredVersion)
      throw new DshPackageError(
        "DSH_INSTALL_FAILED",
        "Installed npm version differs from exact source",
      );
  }
  await validatePackageFiles(packageDirectory, manifest);
  const inventory = await collectDependencies(profileDirectory);
  checkVersions(manifest, runtimeVersions);
  for (const item of inventory) {
    const expectedRuntime = runtimeVersions[item.name];
    // 嵌套副本同样参与 Node 解析；不能只验证最外层 peer 后混用另一个 Cordis/DSH ABI。
    if (expectedRuntime && expectedRuntime !== item.version) {
      throw new Error(
        `Conflicting native runtime version: ${item.name}@${item.version}, expected ${expectedRuntime}`,
      );
    }
    const raw = objectValue(await readJson(join(item.path, "package.json")), "dependency manifest");
    const peers =
      raw.peerDependencies && typeof raw.peerDependencies === "object"
        ? (raw.peerDependencies as Record<string, string>)
        : {};
    await checkPeerVersions({
      name: String(raw.name),
      peers,
      packageDirectory: item.path,
      profileDirectory,
      runtimeVersions,
      runtimeDependencyRoot: options.runtimeDependencyRoot,
      meta: raw.peerDependenciesMeta,
    });
  }
  const baseBundles = input.baseBundles ?? [];
  if (baseBundles.some((name) => !DSH_PACKAGE_NAME.test(name)))
    throw new Error("Invalid base Bundle identity");
  const profile = objectValue(await readJson(join(profileDirectory, "package.json")), "profile");
  const originalDependencies =
    profile.dependencies && typeof profile.dependencies === "object"
      ? (profile.dependencies as Record<string, string>)
      : {};
  const bundles = [
    ...baseBundles,
    ...manifest.profileBundles,
    ...(manifest.bundlePatches.length ? [manifest.name] : []),
  ];
  const originalDsh =
    manifest.raw.dsh && typeof manifest.raw.dsh === "object" && !Array.isArray(manifest.raw.dsh)
      ? objectValue(manifest.raw.dsh, "original dsh metadata")
      : {};
  const originalProfile = originalDsh.profile
    ? objectValue(originalDsh.profile, "original Profile metadata")
    : {};
  await writeJson(join(profileDirectory, "package.json"), {
    ...profile,
    dependencies: { ...originalDependencies, [manifest.name]: manifest.version },
    dsh: { ...originalDsh, profile: { ...originalProfile, bundles } },
  });
  let patches: DshData[] = [];
  if (manifest.entry && !manifest.bundlePatches.length && !manifest.profileBundles.length) {
    patches = [
      {
        insert: [
          {
            id: `plugin-${createHash("sha256").update(manifest.name).digest("hex").slice(0, 16)}`,
            name: manifest.name,
          },
        ],
      },
    ];
  }
  if (originalDsh.profile) {
    const sourcePatch = join(packageDirectory, "cordis.patch.yml");
    try {
      const content = await readFile(sourcePatch, "utf8");
      await writeFile(join(profileDirectory, "cordis.patch.yml"), content, { mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (input.configPatches?.length)
      await writeJson(join(profileDirectory, DSH_HOST_OVERLAY_FILENAME), input.configPatches);
  } else {
    patches.push(...(input.configPatches ?? []));
    await writeJson(join(profileDirectory, "cordis.patch.yml"), patches);
  }
  return {
    manifest,
    dependencyInventory: inventory.map(({ name, version }) => ({
      name,
      version,
      ...(source.kind === "https" && name === packageName ? { integrity: source.integrity } : {}),
    })),
  };
}

async function install(
  command: DshPackageCommand,
  sources: string[],
  cwd: string,
  signal?: AbortSignal,
): Promise<void> {
  const args = sources.length ? ["add", "--save-exact"] : ["install"];
  args.push(
    "--ignore-scripts",
    "--config.auto-install-peers=false",
    "--config.strict-peer-dependencies=false",
    "--config.node-linker=hoisted",
    "--config.manage-package-manager-versions=false",
    "--config.verify-store-integrity=true",
    "--ignore-workspace",
    "--",
    ...sources,
  );
  const result = await command.run(args, { cwd, signal });
  if (result.exitCode !== 0)
    throw new DshPackageError(
      "DSH_INSTALL_FAILED",
      // 修复原因：过去只报告退出码，pnpm 的真实原因（peer 冲突、包不存在、网络失败）
      // 全部丢失，用户只看到 "installation failed (64)" 无从处理。
      // 保留有界的最后几行 stderr 作为诊断；不含凭据（包管理器在受限环境下运行）。
      `DSH package installation failed (${result.exitCode})${summarizeCommandOutput(result.stderr, result.stdout)}`,
    );
}

/** 取命令输出的最后若干行作为诊断摘要；有界，避免把整段安装日志塞进错误消息。 */
function summarizeCommandOutput(stderr: string, stdout: string): string {
  const text = (stderr.trim() || stdout.trim()).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const lines = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const tail = lines.slice(-3).join(" ");
  const bounded = tail.length > 500 ? `${tail.slice(0, 497)}...` : tail;
  return `: ${bounded}`;
}

async function resolvedPackageVersion(
  dependency: string,
  packageDirectory: string,
  profileDirectory?: string,
): Promise<string | undefined> {
  if (!DSH_PACKAGE_NAME.test(dependency)) throw new Error("Invalid peer dependency identity");
  const canonicalProfile = profileDirectory ? await realpath(profileDirectory) : undefined;
  // 使用 Node 自身的有序搜索目录，避免 package.json exports 限制把真实 ESM 包误判为不存在。
  const paths =
    createRequire(join(packageDirectory, "package.json")).resolve.paths(dependency) ?? [];
  for (const modules of paths) {
    if (canonicalProfile) {
      try {
        inside(canonicalProfile, relative(canonicalProfile, modules));
      } catch {
        continue;
      }
    }
    const directory = join(modules, dependency);
    let canonical: string;
    try {
      canonical = await realpath(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (canonicalProfile) inside(canonicalProfile, relative(canonicalProfile, canonical));
    const raw = objectValue(await readJson(join(canonical, "package.json")), "resolved peer");
    if (raw.name !== dependency || typeof raw.version !== "string" || !semver.valid(raw.version))
      throw new Error(`Invalid resolved peer identity: ${dependency}`);
    return raw.version;
  }
  return undefined;
}

async function checkPeerVersions(options: {
  name: string;
  peers: Record<string, string>;
  packageDirectory: string;
  profileDirectory: string;
  runtimeVersions: Readonly<Record<string, string>>;
  runtimeDependencyRoot?: string;
  meta?: unknown;
}): Promise<void> {
  const { name, peers, meta } = options;
  for (const [dependency, range] of Object.entries(peers)) {
    const optional =
      meta &&
      typeof meta === "object" &&
      (meta as Record<string, { optional?: boolean }>)[dependency]?.optional === true;
    // 同名嵌套依赖只对其真实 Node 搜索路径可见；不能由全局 inventory 覆盖其他包的 peer。
    let installed = await resolvedPackageVersion(
      dependency,
      options.packageDirectory,
      options.profileDirectory,
    );
    const expectedRuntime = options.runtimeVersions[dependency];
    if (!installed && expectedRuntime && options.runtimeDependencyRoot) {
      installed = await resolvedPackageVersion(dependency, options.runtimeDependencyRoot);
      if (installed && installed !== expectedRuntime)
        throw new Error(
          `Conflicting runtime fallback version: ${dependency}@${installed}, expected ${expectedRuntime}`,
        );
    }
    if (!installed && optional) continue;
    if (!installed || !semver.satisfies(installed, range, { includePrerelease: true }))
      throw new Error(
        `Unsatisfied peer version: ${name} requires ${dependency}@${range}, found ${installed ?? "missing"}`,
      );
  }
}

function checkVersions(
  manifest: DshPackageManifest,
  versions: Readonly<Record<string, string>>,
): void {
  for (const [name, range] of Object.entries(manifest.engines)) {
    const actual =
      name === "node"
        ? process.versions.node
        : name === "dsh"
          ? versions["@deepseek-ai/dsh"]
          : undefined;
    if (actual && !semver.satisfies(actual, range, { includePrerelease: true }))
      throw new Error(`Unsupported ${name} version: ${actual} does not satisfy ${range}`);
  }
}

async function validatePackageFiles(root: string, manifest: DshPackageManifest): Promise<void> {
  const canonical = await realpath(root);
  for (const path of [manifest.entry, manifest.clientEntry, ...manifest.bundlePatches].filter(
    (path): path is string => Boolean(path),
  )) {
    const file = inside(root, path);
    const resolved = await realpath(file);
    inside(canonical, relative(canonical, resolved));
    if (!(await stat(resolved)).isFile()) throw new Error(`Missing published artifact: ${path}`);
  }
}

async function collectDependencies(
  profile: string,
): Promise<Array<{ name: string; version: string; path: string }>> {
  const canonical = await realpath(profile);
  const results: Array<{ name: string; version: string; path: string }> = [];
  const visited = new Set<string>();
  async function scan(modules: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(modules, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const candidates = entry.name.startsWith("@")
        ? (await readdir(join(modules, entry.name))).map((name) => join(modules, entry.name, name))
        : [join(modules, entry.name)];
      for (const directory of candidates) {
        const path = await realpath(directory);
        inside(canonical, relative(canonical, path));
        if (visited.has(path)) continue;
        visited.add(path);
        if (visited.size > 20_000) throw new Error("Package dependency inventory exceeds limits");
        const raw = objectValue(await readJson(join(path, "package.json")), "dependency");
        if (
          typeof raw.name !== "string" ||
          typeof raw.version !== "string" ||
          !semver.valid(raw.version)
        ) {
          throw new Error(`Invalid dependency identity: ${basename(directory)}`);
        }
        results.push({ name: raw.name, version: raw.version, path });
        await scan(join(path, "node_modules"));
      }
    }
  }
  await scan(join(profile, "node_modules"));
  return results.sort(
    (a, b) => a.name.localeCompare(b.name, "en-US") || a.path.localeCompare(b.path, "en-US"),
  );
}
