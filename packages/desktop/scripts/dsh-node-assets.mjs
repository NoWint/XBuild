// DSH worker 复用应用的 Electron Node，但安装 DSH 包时必须运行真正的 pnpm CLI。
// Electron 二进制不能复制成 bin/node：它依赖同包 Framework；这里提供独立、固定版本的 Node。
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { downloadPrebuiltArchive } from "../../../scripts/prebuilt-binary-download.mjs";
import {
  extractPrebuiltArchive,
  verifyPrebuiltArchiveSha256,
} from "../../../scripts/prebuilt-binary-extract.mjs";

export const DSH_NODE_VERSION = "24.15.0";
export const DSH_NODE_ARTIFACTS = {
  "darwin-arm64": { suffix: "darwin-arm64.tar.xz", sha256: "af5cfaeafe603aaf7599f287fd9d100bb41f16794f49788fa59dd3f25546930f" },
  "darwin-x64": { suffix: "darwin-x64.tar.xz", sha256: "5d627245b9f53cb2512cc21b7aa6aad693106affadd91e0c8f42d600fb7ba444" },
  "linux-arm64": { suffix: "linux-arm64.tar.xz", sha256: "f3d5a797b5d210ce8e2cb265544c8e482eaedcb8aa409a8b46da7e8595d0dda0" },
  "linux-x64": { suffix: "linux-x64.tar.xz", sha256: "472655581fb851559730c48763e0c9d3bc25975c59d518003fc0849d3e4ba0f6" },
  "win32-arm64": { suffix: "win-arm64.zip", sha256: "c9eb7402eda26e2ba7e44b6727fc85a8de56c5095b1f71ebd3062892211aa116" },
  "win32-x64": { suffix: "win-x64.zip", sha256: "cc5149eabd53779ce1e7bdc5401643622d0c7e6800ade18928a767e940bb0e62" },
};

export function dshNodeDownloadUrl(platformKey, version = DSH_NODE_VERSION) {
  const artifact = DSH_NODE_ARTIFACTS[platformKey];
  if (!artifact) throw new Error(`[dsh-node] unsupported target platform: ${platformKey}`);
  return `https://registry.npmmirror.com/-/binary/node/v${version}/node-v${version}-${artifact.suffix}`;
}

export function resolveDshNodeExecutable({ cacheDir, platformKey, executablePath }) {
  if (executablePath) {
    if (!existsSync(executablePath)) throw new Error(`[dsh-node] missing executable: ${executablePath}`);
    return executablePath;
  }
  const artifact = DSH_NODE_ARTIFACTS[platformKey];
  if (!artifact) throw new Error(`[dsh-node] unsupported target platform: ${platformKey}`);
  return join(dshNodeExtractDir({ cacheDir, platformKey }), "bin", platformKey.startsWith("win32") ? "node.exe" : "node");
}

/**
 * 解压目录必须去掉归档扩展名。
 *
 * 归档本体与解压目录同放在 cacheDir 下，两者不能同名：把 suffix 也算进目录名时，
 * 目录 `node-v24.15.0-darwin-x64.tar.xz` 会与归档文件 `node-v24.15.0-darwin-x64.tar.xz`
 * 撞名，mkdir 直接 ENOTDIR（CI 干净检出实测）。本机因为缓存里已有解压结果，
 * 这条路径从没被走到过。
 */
export function dshNodeExtractDir({ cacheDir, platformKey }) {
  const artifact = DSH_NODE_ARTIFACTS[platformKey];
  if (!artifact) throw new Error(`[dsh-node] unsupported target platform: ${platformKey}`);
  const extension = artifact.suffix.endsWith("zip") ? ".zip" : ".tar.xz";
  return join(cacheDir, `node-v${DSH_NODE_VERSION}-${artifact.suffix.slice(0, -extension.length)}`);
}

/** Download only when the verified archive or extracted executable is absent. */
export async function stageDshNodeExecutable({
  cacheDir,
  platformKey,
  executablePath,
  download = downloadPrebuiltArchive,
  extract = extractPrebuiltArchive,
  verifyArchive = verifyPrebuiltArchiveSha256,
}) {
  if (executablePath) {
    if (!existsSync(executablePath)) throw new Error(`[dsh-node] missing executable: ${executablePath}`);
    return executablePath;
  }
  const artifact = DSH_NODE_ARTIFACTS[platformKey];
  if (!artifact) throw new Error(`[dsh-node] unsupported target platform: ${platformKey}`);
  const executable = resolveDshNodeExecutable({ cacheDir, platformKey });
  if (existsSync(executable)) return executable;

  const archiveName = `node-v${DSH_NODE_VERSION}-${artifact.suffix}`;
  const archivePath = join(cacheDir, archiveName);
  mkdirSync(cacheDir, { recursive: true });
  if (!existsSync(archivePath)) {
    await download(dshNodeDownloadUrl(platformKey), archivePath);
  }
  // 已存在和刚下载的归档都必须验真；损坏缓存不能因文件存在就进入分发。
  verifyArchive(archivePath, artifact.sha256);
  const extractRoot = dshNodeExtractDir({ cacheDir, platformKey });
  rmSync(extractRoot, { recursive: true, force: true });
  mkdirSync(extractRoot, { recursive: true });
  extract({ archivePath, archiveExt: artifact.suffix.endsWith("zip") ? "zip" : "tar.xz", extractDir: extractRoot, cwd: cacheDir });
  if (!existsSync(executable)) {
    // Windows 官方 ZIP 把 node.exe 放在包根，而非 POSIX 的 bin/ 下。
    const windowsExecutable = join(extractRoot, "node.exe");
    if (platformKey.startsWith("win32") && existsSync(windowsExecutable)) return windowsExecutable;
    throw new Error(`[dsh-node] executable missing after extraction: ${executable}`);
  }
  return executable;
}
