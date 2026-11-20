#!/usr/bin/env node

import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

const argv = process.argv.slice(2);

function readArg(name) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  return argv[index + 1] ?? null;
}

const artifactPath = readArg("--artifact-path");
if (!artifactPath) {
  throw new Error("Usage: audit-bundle-size.mjs --artifact-path <path-to-artifact>");
}

const absoluteArtifactPath = resolve(artifactPath);
// v3.18.7 实测：DSH 插件生态兼容把一份完整 Node + pnpm + 约 700 包的 dsh-runtime
// 打进 resources/glm（且已按目标平台裁剪原生二进制、清掉 wasm 回退，实测 glm 载荷
// 压缩后 252MiB），叠加 Electron 与壳本身后 mac zip 约 455MiB、Windows 解压后约
// 1.6GB（NSIS 7z 后约 600MiB，超过旧 500MiB 预算连 makensis 的 mmap 都放不下 2.5GB
// 的原始载荷）。700MiB 是有依据的新预算；如再触碰，先查载荷构成而不是直接加预算。
const limitsMb = {
  default: 700,
  ".dmg": 700,
  ".zip": 700,
  ".exe": 700,
  ".appimage": 700,
  ".deb": 700,
};

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

const artifactStat = await stat(absoluteArtifactPath);
const extension = extname(absoluteArtifactPath).toLowerCase();
const limit = limitsMb[extension] ?? limitsMb.default;
const sizeMiB = artifactStat.size / 1024 / 1024;

console.log(`Artifact: ${absoluteArtifactPath}`);
console.log(`Type: ${extension || "<no-extension>"}`);
console.log(`Size: ${formatMiB(artifactStat.size)}`);
console.log(`Limit: ${limit} MiB`);

if (sizeMiB > limit) {
  console.error("Bundle size audit failed:");
  console.error(`  - Artifact exceeds ${limit} MiB`);
  process.exit(1);
}
