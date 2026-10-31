#!/usr/bin/env node
// 应用图标回归检查：所有尺寸必须四角透明、且圆角外不能残留偏白的半透明像素。
// 之前换图标时 icns 四角是不透明白色，Dock 里会露出一圈白角；这个脚本把那条回归钉死。
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const BUILD_DIR = "packages/desktop/build";
const LADDER_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 解码 8-bit RGBA / RGB PNG，返回 { width, height, hasAlpha, pixel(x, y) }。 */
function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("not a PNG");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) {
        throw new Error("interlaced PNG is not supported");
      }
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`unsupported PNG (bitDepth=${bitDepth}, colorType=${colorType})`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(stride * height);

  // PNG 逐行滤波：每行首字节是滤波器类型，按规范还原。
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const source = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? pixels[rowStart + x - channels] : 0;
      const up = y > 0 ? pixels[prevStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[prevStart + x - channels] : 0;
      let value = source[x];

      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) {
        throw new Error(`unknown PNG filter ${filter}`);
      }

      pixels[rowStart + x] = value & 0xff;
    }
  }

  return {
    width,
    height,
    hasAlpha: channels === 4,
    alphaAt: (x, y) => (channels === 4 ? pixels[(y * width + x) * 4 + 3] : 255),
    rgbAt: (x, y) => {
      const base = (y * width + x) * channels;
      return [pixels[base], pixels[base + 1], pixels[base + 2]];
    },
  };
}

function inspectPng(label, buffer, failures) {
  let image;
  try {
    image = decodePng(buffer);
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    return null;
  }

  const corners = [
    [0, 0],
    [image.width - 1, 0],
    [0, image.height - 1],
    [image.width - 1, image.height - 1],
  ];
  for (const [x, y] of corners) {
    const alpha = image.alphaAt(x, y);
    if (alpha !== 0) {
      failures.push(`${label}: corner (${x},${y}) alpha=${alpha}, expected 0`);
    }
  }

  // 圆角外沿若残留高亮度半透明像素，浅色背景上会显出一圈白边。
  let brightFringe = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.alphaAt(x, y);
      if (alpha === 0 || alpha === 255) continue;
      const [r, g, b] = image.rgbAt(x, y);
      if ((r + g + b) / 3 > 200) brightFringe += 1;
    }
  }
  if (brightFringe > 0) {
    failures.push(`${label}: ${brightFringe} bright semi-transparent pixels (white fringe)`);
  }

  return image;
}

/** 从 .icns 容器里取出所有内嵌 PNG（icp4..ic14 / ic07..ic09 等类型）。 */
function extractIcnsPngs(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "icns") {
    throw new Error("not an icns container");
  }

  const entries = [];
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32BE(offset + 4);
    if (length < 8) break;
    const payload = buffer.subarray(offset + 8, offset + length);
    if (payload.subarray(0, 8).equals(PNG_SIGNATURE)) {
      entries.push({ type, payload });
    }
    offset += length;
  }
  return entries;
}

function main() {
  const failures = [];
  const checked = [];

  const singleFiles = [
    { path: `${BUILD_DIR}/icon.png`, expectSize: 1024 },
    { path: `${BUILD_DIR}/icon_windows.png`, expectSize: 1024 },
    { path: `${BUILD_DIR}/icon_installer.png`, expectSize: 1024 },
    { path: "public/icon_512@2x.png", expectSize: 1024 },
  ];

  for (const { path, expectSize } of singleFiles) {
    const image = inspectPng(path, readFileSync(path), failures);
    if (image && (image.width !== expectSize || image.height !== expectSize)) {
      failures.push(`${path}: ${image.width}x${image.height}, expected ${expectSize}x${expectSize}`);
    }
    if (image) checked.push(`${path} (${image.width}x${image.height})`);
  }

  for (const size of LADDER_SIZES) {
    const path = `${BUILD_DIR}/icons/${size}x${size}.png`;
    const image = inspectPng(path, readFileSync(path), failures);
    if (image && (image.width !== size || image.height !== size)) {
      failures.push(`${path}: ${image.width}x${image.height}, expected ${size}x${size}`);
    }
    if (image) checked.push(`${path}`);
  }

  // iconutil 会额外写 ic04/ic05 两个 RLE 老格式小图，PNG 条目从 ic07 起共 8 个（128→1024 及其 @2x）。
  const icnsEntries = extractIcnsPngs(readFileSync(`${BUILD_DIR}/icon.icns`));
  if (icnsEntries.length < 8) {
    failures.push(`icon.icns: only ${icnsEntries.length} embedded PNG entries, expected >= 8`);
  }
  let largest = 0;
  for (const { type, payload } of icnsEntries) {
    const image = inspectPng(`icon.icns:${type}`, payload, failures);
    if (image) largest = Math.max(largest, image.width);
  }
  if (largest !== 1024) {
    failures.push(`icon.icns: largest entry is ${largest}px, expected 1024px`);
  }
  checked.push(`icon.icns (${icnsEntries.length} PNG entries, largest ${largest}px)`);

  // .ico 只校验容器头和目录完整性；像素已由同源的 icon_windows.png 覆盖。
  const ico = readFileSync(`${BUILD_DIR}/icon.ico`);
  if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
    failures.push("icon.ico: invalid ICONDIR header");
  }
  const imageCount = ico.readUInt16LE(4);
  if (imageCount < 6) {
    failures.push(`icon.ico: only ${imageCount} images`);
  }
  checked.push(`icon.ico (${imageCount} images)`);

  if (failures.length > 0) {
    console.error("[verify-app-icons] FAILED");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log(`[verify-app-icons] OK — ${checked.length} assets, all corners transparent, no white fringe`);
  for (const entry of checked) console.log(`  ✓ ${entry}`);

  // 目录里不应有多余的旧尺寸，避免打包时混入过期图标。
  const ladderDir = join(BUILD_DIR, "icons");
  const expected = new Set(LADDER_SIZES.map((size) => `${size}x${size}.png`));
  for (const name of readdirSync(ladderDir)) {
    if (name.endsWith(".png") && !expected.has(name)) {
      console.warn(`[verify-app-icons] warning: unexpected icon ${name}`);
    }
  }
}

main();
