import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

// 只从已有 package.json 的 npm 解析作用域加载公开 Jimp，不依赖 adapters 实现。
const requireAdapters = createRequire(
  new URL("../apps/zcode-cli/packages/adapters/package.json", import.meta.url),
);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const RGBA_CHANNELS = 4;
const RGB_CHANNELS = 3;
const MAX_CHANNEL = 255;
const DIFFERENT_COLOR = [255, 0, 128, 255];
const IGNORED_COLOR = [96, 96, 96, 255];
const OUTPUT_FILES = {
  reference: "reference.png",
  candidate: "candidate.png",
  overlay: "overlay.png",
  difference: "difference.png",
  json: "comparison.json",
  html: "index.html",
};
// 只降低候选 opacity 会保留完整参考图；两层互补权重并在透明组内相加，才与 PNG 预乘混合一致。
const OVERLAY_SCRIPT = `(() => {
  const slider = document.getElementById("overlay-opacity");
  const reference = document.querySelector("[data-overlay-reference]");
  const candidate = document.querySelector("[data-overlay-candidate]");
  const label = document.getElementById("overlay-value");
  const update = () => {
    const weight = Number(slider.value) / 100;
    reference.style.opacity = String(1 - weight);
    candidate.style.opacity = String(weight);
    label.textContent = slider.value + "% candidate";
  };
  slider.addEventListener("input", update);
  update();
})();`;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredPath(value, name) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) {
    throw new TypeError(`${name} must be a nonempty filesystem path`);
  }
  return resolve(value);
}

function unitInterval(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite number in [0, 1]`);
  }
  return value;
}

function snapshotIgnore(ignore) {
  if (!Array.isArray(ignore)) throw new TypeError("ignore must be an array of rectangles");
  return ignore.map((rectangle, index) => {
    if (!isRecord(rectangle)) throw new TypeError(`ignore[${index}] must be a rectangle`);
    const { x, y, width, height, reason } = rectangle;
    for (const [name, value] of Object.entries({ x, y, width, height })) {
      if (!Number.isSafeInteger(value) || value < (name === "x" || name === "y" ? 0 : 1)) {
        throw new RangeError(
          `ignore[${index}].${name} must be a valid integer pixel coordinate/extent`,
        );
      }
    }
    if (typeof reason !== "string" || !reason.trim()) {
      throw new TypeError(`ignore[${index}].reason must be a nonempty string`);
    }
    return { x, y, width, height, reason };
  });
}

async function readPng(path, role, Jimp) {
  try {
    if (!(await fs.stat(path)).isFile()) throw new Error("input is not a regular file");
    const bytes = await fs.readFile(path);
    if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new Error("input does not have a PNG signature");
    }
    // 向 Jimp 传 Buffer，而不是用户路径，避免它把输入当 URL 发起网络请求。
    const image = await Jimp.read(bytes);
    const { width, height, data } = image.bitmap;
    if (
      !Number.isSafeInteger(width) ||
      width <= 0 ||
      !Number.isSafeInteger(height) ||
      height <= 0 ||
      !Number.isSafeInteger(width * height * RGBA_CHANNELS) ||
      data.length !== width * height * RGBA_CHANNELS
    ) {
      throw new Error("decoded PNG dimensions or pixel buffer are invalid");
    }
    return { bytes, image };
  } catch (error) {
    throw new Error(`${role} PNG input could not be read/decoded: ${error.message}`, {
      cause: error,
    });
  }
}

function validateMetadata(metadata, role) {
  if (!isRecord(metadata)) throw new TypeError(`${role} metadata must be a JSON object`);
  const { viewport, deviceScaleFactor, theme, state } = metadata;
  if (
    !isRecord(viewport) ||
    !Number.isFinite(viewport.width) ||
    viewport.width <= 0 ||
    !Number.isFinite(viewport.height) ||
    viewport.height <= 0
  ) {
    throw new TypeError(`${role} metadata.viewport must contain positive numeric width and height`);
  }
  if (!Number.isFinite(deviceScaleFactor) || deviceScaleFactor <= 0) {
    throw new TypeError(`${role} metadata.deviceScaleFactor must be a positive finite number`);
  }
  if (theme !== "light" && theme !== "dark") {
    throw new TypeError(`${role} metadata.theme must be light or dark`);
  }
  if (
    !(typeof state === "string" && state.trim()) &&
    !(isRecord(state) && Object.keys(state).length)
  ) {
    throw new TypeError(`${role} metadata.state must be a nonempty string or JSON object`);
  }
  for (const name of ["product", "version", "source"]) {
    if (role === "reference" || metadata[name] !== undefined) {
      if (typeof metadata[name] !== "string" || !metadata[name].trim()) {
        throw new TypeError(`${role} metadata.${name} must be a nonempty string`);
      }
    }
  }
}

async function readMetadata(path, role) {
  try {
    if (!(await fs.stat(path)).isFile()) throw new Error("metadata is not a regular file");
    const metadata = JSON.parse(await fs.readFile(path, "utf8"));
    validateMetadata(metadata, role);
    return metadata;
  } catch (error) {
    throw new Error(`${role} metadata could not be read/validated: ${error.message}`, {
      cause: error,
    });
  }
}

async function matchingMetadata(referencePath, candidatePath, width, height) {
  if (referencePath === undefined) return null;
  const reference = await readMetadata(referencePath, "reference");
  const candidate = await readMetadata(candidatePath, "candidate");
  for (const name of ["viewport", "deviceScaleFactor", "theme", "state"]) {
    if (!isDeepStrictEqual(reference[name], candidate[name])) {
      throw new Error(`reference/candidate metadata.${name} must match exactly`);
    }
  }
  // 同样的声明也可能是错误声明：防止把错误 viewport 的截图标成 verified-state。
  for (const [role, metadata] of Object.entries({ reference, candidate })) {
    if (
      Math.round(metadata.viewport.width * metadata.deviceScaleFactor) !== width ||
      Math.round(metadata.viewport.height * metadata.deviceScaleFactor) !== height
    ) {
      throw new Error(
        `${role} metadata viewport × deviceScaleFactor does not match PNG dimensions`,
      );
    }
  }
  return { reference, candidate };
}

function ignoreMask(ignore, width, height) {
  const mask = new Uint8Array(width * height);
  let ignoredPixels = 0;
  for (const [index, rectangle] of ignore.entries()) {
    const { x, y, width: w, height: h } = rectangle;
    if (x > width - w || y > height - h) {
      throw new RangeError(`ignore[${index}] rectangle is outside PNG bounds`);
    }
    for (let row = y; row < y + h; row++) {
      for (let column = x; column < x + w; column++) {
        const offset = row * width + column;
        // 重叠遮罩按并集计数，否则面积相加会掩盖全遮罩或产生错误分母。
        if (!mask[offset]) {
          mask[offset] = 1;
          ignoredPixels++;
        }
      }
    }
  }
  if (ignoredPixels === mask.length)
    throw new RangeError("ignore masks must leave at least one compared pixel");
  return { mask, ignoredPixels };
}

function analyzeImages(reference, candidate, ignore, threshold) {
  const { width, height, data: referenceData } = reference.bitmap;
  const candidateData = candidate.bitmap.data;
  const totalPixels = width * height;
  const { mask, ignoredPixels } = ignoreMask(ignore, width, height);
  const overlay = Buffer.alloc(totalPixels * RGBA_CHANNELS);
  const difference = Buffer.alloc(totalPixels * RGBA_CHANNELS);
  let differentPixels = 0;
  let channelDeltaSum = 0;
  let maxChannelDelta = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < totalPixels; index++) {
    const offset = index * RGBA_CHANNELS;
    const referenceAlpha = referenceData[offset + RGB_CHANNELS];
    const candidateAlpha = candidateData[offset + RGB_CHANNELS];
    const combinedAlpha = referenceAlpha + candidateAlpha;
    for (let channel = 0; channel < RGB_CHANNELS; channel++) {
      overlay[offset + channel] = combinedAlpha
        ? Math.round(
            (referenceData[offset + channel] * referenceAlpha +
              candidateData[offset + channel] * candidateAlpha) /
              combinedAlpha,
          )
        : 0;
    }
    overlay[offset + RGB_CHANNELS] = Math.round(combinedAlpha / 2);
    difference[offset + RGB_CHANNELS] = MAX_CHANNEL;
    if (mask[index]) {
      difference.set(IGNORED_COLOR, offset);
      continue;
    }

    let pixelDelta = 0;
    for (let channel = 0; channel < RGB_CHANNELS; channel++) {
      const referenceChannel = referenceData[offset + channel];
      const candidateChannel = candidateData[offset + channel];
      // 用黑/白底上的可见合成色取最大值；全透明隐藏 RGB 不计分，白色 alpha 变化也不会在白底假通过。
      const blackDelta = Math.abs(
        referenceChannel * referenceAlpha - candidateChannel * candidateAlpha,
      );
      const whiteDelta = Math.abs(
        (referenceChannel - MAX_CHANNEL) * referenceAlpha -
          (candidateChannel - MAX_CHANNEL) * candidateAlpha,
      );
      const delta = Math.max(blackDelta, whiteDelta) / (MAX_CHANNEL * MAX_CHANNEL);
      channelDeltaSum += delta;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      pixelDelta = Math.max(pixelDelta, delta);
    }
    if (pixelDelta > threshold) {
      differentPixels++;
      difference.set(DIFFERENT_COLOR, offset);
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const comparedPixels = totalPixels - ignoredPixels;
  return {
    overlay,
    difference,
    statistics: {
      width,
      height,
      totalPixels,
      comparedPixels,
      ignoredPixels,
      differentPixels,
      differenceRatio: differentPixels / comparedPixels,
      meanChannelDelta: channelDeltaSum / (comparedPixels * RGB_CHANNELS),
      maxChannelDelta,
      differenceBounds: differentPixels
        ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
        : null,
    },
  };
}

function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}

function reportHtml(result) {
  const referenceLabel = basename(result.inputs.referencePath);
  const candidateLabel = basename(result.inputs.candidatePath);
  const scriptHash = createHash("sha256").update(OVERLAY_SCRIPT).digest("base64");
  const csp = `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'sha256-${scriptHash}'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'`;
  const certification =
    result.certification === "verified-state"
      ? "Verified declared state: matching metadata for the provided image pair, not capture authenticity or app-wide equivalence."
      : "Unverified image comparison: no capture metadata supplied; this is not product or app-wide certification.";
  const statistics = [
    ["Status under supplied tolerances", result.status],
    ["Certification", result.certification],
    ["PNG dimensions", `${result.width} × ${result.height}`],
    ["Total pixels", result.totalPixels],
    ["Compared pixels", result.comparedPixels],
    ["Explicitly ignored pixels", result.ignoredPixels],
    ["Different pixels", result.differentPixels],
    ["Difference ratio (different / compared)", result.differenceRatio],
    ["Mean normalized channel delta", result.meanChannelDelta],
    ["Maximum normalized channel delta", result.maxChannelDelta],
    ["Pixel threshold (strictly exceeded)", result.threshold],
    ["Maximum allowed difference ratio", result.maxDifferenceRatio],
    ["Difference bounds", JSON.stringify(result.differenceBounds)],
  ]
    .map(
      ([label, value]) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("\n");
  const masks = result.ignore.length
    ? `<table><caption>Explicit ignore rectangles, in original PNG pixels</caption><thead><tr><th>x</th><th>y</th><th>width</th><th>height</th><th>Reason</th></tr></thead><tbody>${result.ignore.map((rectangle) => `<tr>${[rectangle.x, rectangle.y, rectangle.width, rectangle.height, rectangle.reason].map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("\n")}</tbody></table>`
    : "<p>No pixels were automatically or explicitly ignored.</p>";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<title>${escapeHtml(`Desktop UI image comparison — ${referenceLabel} vs ${candidateLabel}`)}</title>
<style>
:root { color-scheme: light dark; font-family: system-ui, sans-serif; color: #202020; background: #fafafa; }
body { max-width: 1120px; margin: 0 auto; padding: 24px; line-height: 1.5; }
h1 { font-size: 24px; } h2 { font-size: 20px; margin-top: 28px; }
a { color: inherit; } figure { margin: 0; min-width: 0; } figcaption { overflow-wrap: anywhere; }
.pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
img { display: block; max-width: 100%; height: auto; }
.image-surface { background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 0 / 16px 16px; border: 1px solid #777; }
.blend { position: relative; isolation: isolate; width: 100%; aspect-ratio: ${result.width} / ${result.height}; overflow: hidden; }
.blend img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.blend [data-overlay-candidate] { mix-blend-mode: plus-lighter; }
input[type="range"] { width: min(100%, 480px); display: block; margin: 12px 0; }
input:focus-visible, a:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; } caption { text-align: left; font-weight: 600; }
th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid #ccc; overflow-wrap: anywhere; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 16px; border: 1px solid #777; }
.difference { image-rendering: pixelated; } .notice { border: 1px solid #777; padding: 12px; }
@media (max-width: 700px) { .pair { grid-template-columns: 1fr; } body { padding: 16px; } }
@media (prefers-color-scheme: dark) { :root { background: #151515; color: #eee; } th, td { border-color: #555; } }
@media (forced-colors: active) { .notice, .image-surface, pre { border-color: CanvasText; } }
</style>
</head>
<body>
<h1>Desktop UI image comparison</h1>
<p class="notice">${escapeHtml(certification)}</p>
<p>Only the supplied screenshots are measured. Untested pages, interaction, motion and ignored areas are not certified. Matching means the reported difference ratio is within the supplied tolerance.</p>
<table><caption>Measured image-pair statistics</caption><tbody>${statistics}</tbody></table>
<p>Each channel uses the maximum visible composited delta over black and white backgrounds, normalized to [0, 1]. Fully transparent hidden RGB does not count. Mean delta includes below-threshold differences, but excludes ignored pixels.</p>
<h2>Original images</h2>
<div class="pair">
<figure><div class="image-surface"><img src="reference.png" alt="${escapeHtml(`Reference: ${referenceLabel}`)}" width="${result.width}" height="${result.height}"></div><figcaption>Reference: ${escapeHtml(referenceLabel)} — <a href="reference.png">native-size PNG</a></figcaption></figure>
<figure><div class="image-surface"><img src="candidate.png" alt="${escapeHtml(`Candidate: ${candidateLabel}`)}" width="${result.width}" height="${result.height}"></div><figcaption>Candidate: ${escapeHtml(candidateLabel)} — <a href="candidate.png">native-size PNG</a></figcaption></figure>
</div>
<h2>Interactive overlay</h2>
<label for="overlay-opacity">Candidate weight: <output id="overlay-value" for="overlay-opacity">50% candidate</output></label>
<input id="overlay-opacity" type="range" min="0" max="100" step="1" value="50">
<div class="image-surface"><div class="blend"><img src="reference.png" alt="Overlay reference" data-overlay-reference style="opacity: 0.5"><img src="candidate.png" alt="Overlay candidate" data-overlay-candidate style="opacity: 0.5"></div></div>
<p><a href="overlay.png">Download the premultiplied 50/50 overlay PNG</a>. Transparent pixels are shown over a checkerboard; the two original PNGs remain unchanged.</p>
<h2>Difference image</h2>
<p>Magenta: above-threshold difference. Black: compared, within threshold. Gray: explicitly ignored. Exact counts and difference coordinates are also recorded in <a href="comparison.json">comparison.json</a>.</p>
<figure><div class="image-surface"><img class="difference" src="difference.png" alt="High-contrast difference: magenta changed, black within threshold, gray explicitly ignored" width="${result.width}" height="${result.height}"></div><figcaption><a href="difference.png">Native-size difference PNG</a></figcaption></figure>
<h2>Ignore evidence</h2>
${masks}
<h2>Declared source metadata</h2>
<pre>${escapeHtml(JSON.stringify(result.metadata, null, 2))}</pre>
<script>${OVERLAY_SCRIPT}</script>
</body>
</html>
`;
}

async function inspectOutput(outputDirectory) {
  let stat;
  try {
    stat = await fs.lstat(outputDirectory);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error("outputDirectory must not be a symlink");
  if (!stat.isDirectory())
    throw new Error("outputDirectory must be a directory, not an input/file");
  if ((await fs.readdir(outputDirectory)).length) {
    throw new Error(
      "outputDirectory must be empty; refusing to overwrite existing output or inputs",
    );
  }
  return true;
}

async function publishArtifacts(outputDirectory, artifacts) {
  const parent = dirname(outputDirectory);
  let firstCreatedParent;
  let stagingDirectory;
  let removedEmptyOutput = false;
  try {
    firstCreatedParent = await fs.mkdir(parent, { recursive: true });
    // 同级独立空目录是此次调用唯一的写入所有者；失败时只清理它，不递归删除输出目录。
    stagingDirectory = await fs.mkdtemp(join(parent, ".desktop-ui-compare-"));
    for (const [filename, contents] of artifacts) {
      await fs.writeFile(join(stagingDirectory, filename), contents, { flag: "wx" });
    }
    if (await inspectOutput(outputDirectory)) {
      // rmdir 只允许空目录；rename 的目标不存在，兼容 Windows，且并发非空输出不会被覆盖。
      await fs.rmdir(outputDirectory);
      removedEmptyOutput = true;
    }
    await fs.rename(stagingDirectory, outputDirectory);
  } catch (error) {
    const cleanupErrors = [];
    if (stagingDirectory) {
      try {
        await fs.rm(stagingDirectory, { recursive: true, force: true });
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (removedEmptyOutput) {
      try {
        await fs.mkdir(outputDirectory);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (firstCreatedParent) {
      for (let path = parent; ; path = dirname(path)) {
        try {
          await fs.rmdir(path);
        } catch (cleanupError) {
          if (cleanupError.code !== "ENOENT") cleanupErrors.push(cleanupError);
          break;
        }
        if (path === resolve(firstCreatedParent) || dirname(path) === path) break;
      }
    }
    if (cleanupErrors.length) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        `Comparison failed and rollback/cleanup also failed: ${error.message}; ${cleanupErrors.map((item) => item.message).join("; ")}`,
        { cause: error },
      );
    }
    throw error;
  }
}

/**
 * Compare two local PNGs; never rescale or claim app-wide visual certification.
 * Metadata must be paired; reference requires product/version/source. State may
 * be a nonempty string or JSON object. viewport × deviceScaleFactor must round
 * to the PNG dimensions. Deltas are normalized visible RGB over black/white.
 * Inputs → snapshot/validation → calculation → private staging → publication.
 * This invocation owns all temporary state; CLI only maps arguments/exit codes.
 *
 * @param {object} options
 * @returns {Promise<object>} Fully published matched/different result, or rejection.
 */
export async function compareDesktopImages(options) {
  if (!isRecord(options))
    throw new TypeError("options must contain referencePath, candidatePath and outputDirectory");
  const referencePath = requiredPath(options.referencePath, "referencePath");
  const candidatePath = requiredPath(options.candidatePath, "candidatePath");
  const outputDirectory = requiredPath(options.outputDirectory, "outputDirectory");
  const threshold = unitInterval(
    options.threshold === undefined ? 0.1 : options.threshold,
    "threshold",
  );
  const maxDifferenceRatio = unitInterval(
    options.maxDifferenceRatio === undefined ? 0.01 : options.maxDifferenceRatio,
    "maxDifferenceRatio",
  );
  const ignore = snapshotIgnore(options.ignore === undefined ? [] : options.ignore);
  const hasReferenceMetadata = options.referenceMetadataPath !== undefined;
  const hasCandidateMetadata = options.candidateMetadataPath !== undefined;
  if (hasReferenceMetadata !== hasCandidateMetadata) {
    throw new Error(
      "reference and candidate metadata paths must both be supplied together or both omitted",
    );
  }
  const referenceMetadataPath = hasReferenceMetadata
    ? requiredPath(options.referenceMetadataPath, "referenceMetadataPath")
    : undefined;
  const candidateMetadataPath = hasCandidateMetadata
    ? requiredPath(options.candidateMetadataPath, "candidateMetadataPath")
    : undefined;
  if (
    [referencePath, candidatePath, referenceMetadataPath, candidateMetadataPath].includes(
      outputDirectory,
    )
  ) {
    throw new Error("outputDirectory must not equal an input PNG or metadata path");
  }
  await inspectOutput(outputDirectory);
  const { Jimp } = requireAdapters("jimp");
  const reference = await readPng(referencePath, "reference", Jimp);
  const candidate = await readPng(candidatePath, "candidate", Jimp);
  const { width, height } = reference.image.bitmap;
  if (width !== candidate.image.bitmap.width || height !== candidate.image.bitmap.height) {
    throw new Error(
      `PNG dimensions must match exactly: reference ${width}×${height}, candidate ${candidate.image.bitmap.width}×${candidate.image.bitmap.height}`,
    );
  }
  const metadata = await matchingMetadata(
    referenceMetadataPath,
    candidateMetadataPath,
    width,
    height,
  );
  const { overlay, difference, statistics } = analyzeImages(
    reference.image,
    candidate.image,
    ignore,
    threshold,
  );
  const outputs = Object.fromEntries(
    Object.entries(OUTPUT_FILES).map(([key, filename]) => [key, join(outputDirectory, filename)]),
  );
  const result = {
    status: statistics.differenceRatio <= maxDifferenceRatio ? "matched" : "different",
    certification: metadata ? "verified-state" : "unverified",
    ...statistics,
    threshold,
    maxDifferenceRatio,
    comparisonBackgrounds: ["black", "white"],
    ignore,
    metadata,
    inputs: {
      referencePath,
      candidatePath,
      referenceMetadataPath: referenceMetadataPath ?? null,
      candidateMetadataPath: candidateMetadataPath ?? null,
    },
    outputs,
  };
  const overlayPng = await Jimp.fromBitmap({ data: overlay, width, height }).getBuffer("image/png");
  const differencePng = await Jimp.fromBitmap({ data: difference, width, height }).getBuffer(
    "image/png",
  );
  await publishArtifacts(outputDirectory, [
    [OUTPUT_FILES.reference, reference.bytes],
    [OUTPUT_FILES.candidate, candidate.bytes],
    [OUTPUT_FILES.overlay, overlayPng],
    [OUTPUT_FILES.difference, differencePng],
    [OUTPUT_FILES.json, JSON.stringify(result, null, 2) + "\n"],
    [OUTPUT_FILES.html, reportHtml(result)],
  ]);
  return result;
}
