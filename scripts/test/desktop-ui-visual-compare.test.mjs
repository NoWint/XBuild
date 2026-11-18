import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs, { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const requireAdapters = createRequire(
  new URL("../../apps/zcode-cli/packages/adapters/package.json", import.meta.url),
);
const { Jimp } = requireAdapters("jimp");
const { JSDOM } = createRequire(new URL("../../package.json", import.meta.url))("jsdom");
const exec = promisify(execFile);
const entry = fileURLToPath(new URL("../compare-desktop-ui.mjs", import.meta.url));
const imageFiles = [
  "candidate.png",
  "comparison.json",
  "difference.png",
  "index.html",
  "overlay.png",
  "reference.png",
];

async function literalPng({ width = 2, height = 2, pixels = [] } = {}) {
  const image = new Jimp({ width, height, color: 0xffffffff });
  for (const [x, y, rgba] of pixels) image.bitmap.data.set(rgba, (y * width + x) * 4);
  return image.getBuffer("image/png");
}

async function fixture(
  t,
  { reference, candidate, referenceName = "reference screenshot.png" } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "desktop-ui-visual-compare-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const referencePath = join(root, referenceName);
  const candidatePath = join(root, "candidate screenshot.png");
  await writeFile(referencePath, await literalPng(reference));
  await writeFile(candidatePath, await literalPng(candidate));
  const outputDirectory = join(root, "comparison");
  return { root, referencePath, candidatePath, outputDirectory };
}

async function comparator() {
  // 动态加载让 RED 明确指向缺失实现；夹具自身另有真实 PNG 解码检查。
  const implementation = await import("../desktop-ui-visual-compare.mjs");
  assert.equal(typeof implementation.compareDesktopImages, "function");
  return implementation.compareDesktopImages;
}

async function invoke(root, args) {
  try {
    return {
      code: 0,
      ...(await exec(process.execPath, [entry, ...args], { cwd: root, maxBuffer: 2_000_000 })),
    };
  } catch (error) {
    if (typeof error.code !== "number") throw error;
    return { code: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

function cliArgs(f) {
  return [
    "--reference",
    f.referencePath,
    "--candidate",
    f.candidatePath,
    "--out-dir",
    f.outputDirectory,
  ];
}

function declaredMetadata(product = "Reference fixture") {
  return {
    viewport: { width: 2, height: 2 },
    deviceScaleFactor: 1,
    theme: "light",
    state: "new-chat",
    product,
    version: "fixture-1",
    source: "synthetic-engineering-fixture",
  };
}

async function metadataPair(
  f,
  reference = declaredMetadata(),
  candidate = declaredMetadata("XBuild fixture"),
) {
  const referenceMetadataPath = join(f.root, "reference-meta.json");
  const candidateMetadataPath = join(f.root, "candidate-meta.json");
  await writeFile(referenceMetadataPath, JSON.stringify(reference));
  await writeFile(candidateMetadataPath, JSON.stringify(candidate));
  return { referenceMetadataPath, candidateMetadataPath };
}

async function absent(path) {
  await assert.rejects(readFile(path), { code: "ENOENT" });
}

async function noOutput(f) {
  await absent(join(f.outputDirectory, "comparison.json"));
  await assert.rejects(readdir(f.outputDirectory), { code: "ENOENT" });
}

function pixel(image, x, y) {
  const offset = (y * image.bitmap.width + x) * 4;
  return [...image.bitmap.data.subarray(offset, offset + 4)];
}

const oneBlackPixel = { pixels: [[1, 0, [0, 0, 0, 255]]] };

test("literal PNG fixtures really contain the hand-specified RGBA pixels", async (t) => {
  const f = await fixture(t, { candidate: oneBlackPixel });
  const reference = await Jimp.read(await readFile(f.referencePath));
  const candidate = await Jimp.read(await readFile(f.candidatePath));
  assert.equal(reference.bitmap.width, 2);
  assert.equal(reference.bitmap.height, 2);
  assert.deepEqual(pixel(reference, 1, 0), [255, 255, 255, 255]);
  assert.deepEqual(pixel(candidate, 1, 0), [0, 0, 0, 255]);
  assert.deepEqual(pixel(candidate, 0, 1), [255, 255, 255, 255]);
});

test("CLI help succeeds without reading inputs or creating an output directory", async (t) => {
  const f = await fixture(t);
  const before = await readdir(f.root);
  const result = await invoke(f.root, [
    "--help",
    "--reference",
    "missing.png",
    "--out-dir",
    f.outputDirectory,
  ]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /--reference/);
  assert.match(result.stdout, /--candidate/);
  assert.match(result.stdout, /--ignore/);
  assert.equal(result.stderr, "");
  assert.deepEqual(await readdir(f.root), before);
});

test("identical images publish decodable local artifacts without claiming verified state", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  const result = await compare(f);
  assert.equal(result.status, "matched");
  assert.equal(result.certification, "unverified");
  assert.equal(result.width, 2);
  assert.equal(result.height, 2);
  assert.equal(result.totalPixels, 4);
  assert.equal(result.comparedPixels, 4);
  assert.equal(result.ignoredPixels, 0);
  assert.equal(result.differentPixels, 0);
  assert.equal(result.differenceRatio, 0);
  assert.equal(result.meanChannelDelta, 0);
  assert.equal(result.maxChannelDelta, 0);
  assert.equal(result.differenceBounds, null);
  assert.equal(result.threshold, 0.1);
  assert.equal(result.maxDifferenceRatio, 0.01);
  assert.equal(result.metadata, null);
  assert.deepEqual(result.ignore, []);
  assert.deepEqual((await readdir(f.outputDirectory)).sort(), imageFiles);
  for (const key of ["reference", "candidate", "overlay", "difference"]) {
    const image = await Jimp.read(await readFile(result.outputs[key]));
    assert.equal(image.bitmap.width, 2);
    assert.equal(image.bitmap.height, 2);
  }
  assert.deepEqual(await readFile(result.outputs.reference), await readFile(f.referencePath));
  assert.deepEqual(await readFile(result.outputs.candidate), await readFile(f.candidatePath));
  assert.deepEqual(JSON.parse(await readFile(result.outputs.json, "utf8")), result);
  assert.match(await readFile(result.outputs.html, "utf8"), /unverified image comparison/i);
});

test("one changed pixel has literal ratio, channel statistics, bounds, blend and high-contrast difference", async (t) => {
  const f = await fixture(t, { candidate: oneBlackPixel });
  const compare = await comparator();
  const result = await compare(f);
  assert.equal(result.status, "different");
  assert.equal(result.certification, "unverified");
  assert.equal(result.differentPixels, 1);
  assert.equal(result.differenceRatio, 0.25);
  assert.equal(result.meanChannelDelta, 0.25);
  assert.equal(result.maxChannelDelta, 1);
  assert.deepEqual(result.differenceBounds, { x: 1, y: 0, width: 1, height: 1 });
  const overlay = await Jimp.read(await readFile(result.outputs.overlay));
  const difference = await Jimp.read(await readFile(result.outputs.difference));
  assert.deepEqual(pixel(overlay, 1, 0), [128, 128, 128, 255]);
  assert.deepEqual(pixel(overlay, 0, 0), [255, 255, 255, 255]);
  assert.deepEqual(pixel(difference, 1, 0), [255, 0, 128, 255]);
  assert.deepEqual(pixel(difference, 0, 0), [0, 0, 0, 255]);
});

test("difference bounds enclose separated changed pixels", async (t) => {
  const f = await fixture(t, {
    candidate: {
      pixels: [
        [0, 0, [0, 0, 0, 255]],
        [1, 1, [0, 0, 0, 255]],
      ],
    },
  });
  const compare = await comparator();
  const result = await compare(f);
  assert.equal(result.differentPixels, 2);
  assert.equal(result.differenceRatio, 0.5);
  assert.deepEqual(result.differenceBounds, { x: 0, y: 0, width: 2, height: 2 });
});

test("fully transparent hidden RGB differences do not change visible scores or overlay", async (t) => {
  const f = await fixture(t, {
    reference: {
      pixels: [
        [0, 0, [255, 0, 0, 0]],
        [1, 0, [255, 0, 0, 0]],
        [0, 1, [255, 0, 0, 0]],
        [1, 1, [255, 0, 0, 0]],
      ],
    },
    candidate: {
      pixels: [
        [0, 0, [0, 255, 255, 0]],
        [1, 0, [0, 255, 255, 0]],
        [0, 1, [0, 255, 255, 0]],
        [1, 1, [0, 255, 255, 0]],
      ],
    },
  });
  const compare = await comparator();
  const result = await compare({ ...f, threshold: 0, maxDifferenceRatio: 0 });
  assert.equal(result.status, "matched");
  assert.equal(result.comparedPixels, 4);
  assert.equal(result.differentPixels, 0);
  assert.equal(result.differenceRatio, 0);
  assert.equal(result.differenceBounds, null);
  assert.equal(result.maxChannelDelta, 0);
  assert.equal(result.meanChannelDelta, 0);
  assert.deepEqual(
    pixel(await Jimp.read(await readFile(result.outputs.overlay)), 1, 0),
    [0, 0, 0, 0],
  );
});

for (const [name, rgba] of [
  ["black", [0, 0, 0, 255]],
  ["white", [255, 255, 255, 255]],
]) {
  test(`opaque versus transparent ${name} is visible on a contrasting background`, async (t) => {
    const f = await fixture(t, {
      reference: { pixels: [[1, 0, rgba]] },
      candidate: { pixels: [[1, 0, [rgba[0], rgba[1], rgba[2], 0]]] },
    });
    const compare = await comparator();
    const result = await compare(f);
    assert.equal(result.status, "different");
    assert.equal(result.differentPixels, 1);
    assert.equal(result.differenceRatio, 0.25);
    assert.equal(result.maxChannelDelta, 1);
  });
}

test("semi-transparent visibility uses premultiplied color and the overlay ignores hidden RGB", async (t) => {
  const f = await fixture(t, {
    reference: { pixels: [[1, 0, [255, 255, 255, 0]]] },
    candidate: { pixels: [[1, 0, [0, 0, 0, 128]]] },
  });
  const compare = await comparator();
  const result = await compare(f);
  assert.equal(result.differentPixels, 1);
  assert.ok(Math.abs(result.maxChannelDelta - 128 / 255) < 1e-12);
  assert.ok(Math.abs(result.meanChannelDelta - 128 / 1020) < 1e-12);
  assert.deepEqual(
    pixel(await Jimp.read(await readFile(result.outputs.overlay)), 1, 0),
    [0, 0, 0, 64],
  );
});

test("threshold and ratio bounds are inclusive, but deltas must exceed threshold", async (t) => {
  const f = await fixture(t, { candidate: { pixels: [[1, 0, [230, 230, 230, 255]]] } });
  const compare = await comparator();
  const atThreshold = await compare({ ...f, threshold: 25 / 255, maxDifferenceRatio: 0 });
  assert.equal(atThreshold.status, "matched");
  assert.equal(atThreshold.differentPixels, 0);
  assert.equal(atThreshold.differenceBounds, null);
  assert.ok(Math.abs(atThreshold.maxChannelDelta - 25 / 255) < 1e-12);
  assert.ok(Math.abs(atThreshold.meanChannelDelta - 25 / 1020) < 1e-12);
  const atRatio = await compare({
    ...f,
    outputDirectory: join(f.root, "at-ratio"),
    threshold: 0,
    maxDifferenceRatio: 0.25,
  });
  assert.equal(atRatio.status, "matched");
  assert.equal(atRatio.differenceRatio, 0.25);
  const belowRatio = await compare({
    ...f,
    outputDirectory: join(f.root, "below-ratio"),
    threshold: 0,
    maxDifferenceRatio: 0.249,
  });
  assert.equal(belowRatio.status, "different");
  const endpoints = await compare({
    ...f,
    outputDirectory: join(f.root, "endpoints"),
    threshold: 1,
    maxDifferenceRatio: 1,
  });
  assert.equal(endpoints.status, "matched");
});

test("an explicit partial mask excludes only its pixels and preserves original coordinates and reason", async (t) => {
  const f = await fixture(t, { candidate: oneBlackPixel });
  const compare = await comparator();
  const ignore = [{ x: 1, y: 0, width: 1, height: 1, reason: "Transient test cursor" }];
  const result = await compare({ ...f, ignore });
  assert.equal(result.status, "matched");
  assert.equal(result.totalPixels, 4);
  assert.equal(result.comparedPixels, 3);
  assert.equal(result.ignoredPixels, 1);
  assert.equal(result.differentPixels, 0);
  assert.equal(result.differenceRatio, 0);
  assert.equal(result.meanChannelDelta, 0);
  assert.equal(result.maxChannelDelta, 0);
  assert.equal(result.differenceBounds, null);
  assert.deepEqual(result.ignore, ignore);
  assert.deepEqual(
    pixel(await Jimp.read(await readFile(result.outputs.difference)), 1, 0),
    [96, 96, 96, 255],
  );
});

test("overlapping masks count their union and use compared pixels as the ratio denominator", async (t) => {
  const f = await fixture(t, { candidate: { pixels: [[0, 1, [0, 0, 0, 255]]] } });
  const compare = await comparator();
  const result = await compare({
    ...f,
    ignore: [
      { x: 0, y: 0, width: 2, height: 1, reason: "Top row" },
      { x: 1, y: 0, width: 1, height: 2, reason: "Right column" },
    ],
  });
  assert.equal(result.ignoredPixels, 3);
  assert.equal(result.comparedPixels, 1);
  assert.equal(result.differentPixels, 1);
  assert.equal(result.differenceRatio, 1);
  assert.equal(result.meanChannelDelta, 1);
  assert.deepEqual(result.differenceBounds, { x: 0, y: 1, width: 1, height: 1 });
});

for (const [name, ignore] of [
  ["single complete mask", [{ x: 0, y: 0, width: 2, height: 2, reason: "Everything" }]],
  [
    "union of complete masks",
    [
      { x: 0, y: 0, width: 2, height: 1, reason: "Top" },
      { x: 0, y: 1, width: 2, height: 1, reason: "Bottom" },
    ],
  ],
  ["out of bounds", [{ x: 1, y: 0, width: 2, height: 1, reason: "Outside" }]],
  ["negative origin", [{ x: -1, y: 0, width: 1, height: 1, reason: "Outside" }]],
  ["fractional coordinate", [{ x: 0.5, y: 0, width: 1, height: 1, reason: "Fraction" }]],
  ["zero extent", [{ x: 0, y: 0, width: 0, height: 1, reason: "Empty" }]],
  ["nonfinite extent", [{ x: 0, y: 0, width: Infinity, height: 1, reason: "Infinity" }]],
  [
    "unsafe extent",
    [{ x: 0, y: 0, width: Number.MAX_SAFE_INTEGER + 1, height: 1, reason: "Overflow" }],
  ],
  ["missing reason", [{ x: 0, y: 0, width: 1, height: 1 }]],
  ["blank reason", [{ x: 0, y: 0, width: 1, height: 1, reason: " \n " }]],
  ["nonstring reason", [{ x: 0, y: 0, width: 1, height: 1, reason: 1 }]],
  ["null rectangle", [null]],
  ["nonarray masks", {}],
  ["null masks", null],
]) {
  test(`invalid ignore input rejects ${name} without a report`, async (t) => {
    const f = await fixture(t);
    const compare = await comparator();
    await assert.rejects(compare({ ...f, ignore }), /ignore|mask|rectangle|compared/i);
    await noOutput(f);
  });
}

for (const parameter of ["threshold", "maxDifferenceRatio"]) {
  for (const value of [NaN, Infinity, -Infinity, -0.01, 1.01, "0.1", null, true]) {
    test(`${parameter} rejects ${String(value)} rather than manufacturing a score`, async (t) => {
      const f = await fixture(t);
      const compare = await comparator();
      await assert.rejects(compare({ ...f, [parameter]: value }), new RegExp(parameter));
      await noOutput(f);
    });
  }
}

test("same declared capture state retains both provenances and limits verification to the provided pair", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  const reference = declaredMetadata();
  const candidate = declaredMetadata("XBuild fixture");
  const metadata = await metadataPair(f, reference, candidate);
  const result = await compare({ ...f, ...metadata });
  assert.equal(result.certification, "verified-state");
  assert.equal(result.status, "matched");
  assert.deepEqual(result.metadata, { reference, candidate });
  const html = await readFile(result.outputs.html, "utf8");
  assert.match(html, /provided (image|screenshot) pair/i);
  assert.match(html, /not.*app-wide/i);
  assert.match(html, /synthetic-engineering-fixture/);
});

test("structured state equality is independent of JSON property order", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  const reference = { ...declaredMetadata(), state: { page: "chat", menu: "closed" } };
  const candidate = {
    ...declaredMetadata("XBuild fixture"),
    state: { menu: "closed", page: "chat" },
  };
  const result = await compare({ ...f, ...(await metadataPair(f, reference, candidate)) });
  assert.equal(result.certification, "verified-state");
});

for (const [field, replacement] of [
  ["theme", "dark"],
  ["state", "chat-streaming"],
  ["viewport", { width: 3, height: 2 }],
  ["deviceScaleFactor", 2],
]) {
  test(`mismatched metadata ${field} cannot certify an image pair`, async (t) => {
    const f = await fixture(t);
    const compare = await comparator();
    const metadata = await metadataPair(f, declaredMetadata(), {
      ...declaredMetadata("XBuild fixture"),
      [field]: replacement,
    });
    await assert.rejects(
      compare({ ...f, ...metadata }),
      /metadata|viewport|theme|state|deviceScaleFactor/i,
    );
    await noOutput(f);
  });
}

for (const field of ["referenceMetadataPath", "candidateMetadataPath"]) {
  test(`one-sided ${field} rejects instead of silently becoming unverified`, async (t) => {
    const f = await fixture(t);
    const compare = await comparator();
    const metadata = await metadataPair(f);
    await assert.rejects(compare({ ...f, [field]: metadata[field] }), /metadata|together|both/i);
    await noOutput(f);
  });
}

for (const [name, reference] of [
  ["empty object", {}],
  ["invalid theme", { ...declaredMetadata(), theme: "system" }],
  ["blank state", { ...declaredMetadata(), state: "  " }],
  ["empty state object", { ...declaredMetadata(), state: {} }],
  ["invalid viewport", { ...declaredMetadata(), viewport: { width: 0, height: 2 } }],
  ["invalid scale", { ...declaredMetadata(), deviceScaleFactor: 0 }],
  ["missing reference product", { ...declaredMetadata(), product: null }],
  ["missing reference version", { ...declaredMetadata(), version: "" }],
  ["missing reference source", { ...declaredMetadata(), source: " " }],
]) {
  test(`invalid metadata ${name} rejects instead of emitting verified-state`, async (t) => {
    const f = await fixture(t);
    const compare = await comparator();
    const metadata = await metadataPair(f, reference, reference);
    await assert.rejects(
      compare({ ...f, ...metadata }),
      /metadata|viewport|theme|state|deviceScaleFactor|product|version|source/i,
    );
    await noOutput(f);
  });
}

test("matching metadata cannot assert a viewport inconsistent with the PNG dimensions", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  const wrong = { ...declaredMetadata(), viewport: { width: 1200, height: 800 } };
  await assert.rejects(
    compare({ ...f, ...(await metadataPair(f, wrong, wrong)) }),
    /viewport|dimension|metadata/i,
  );
  await noOutput(f);
});

test("scaled viewport metadata is compared in CSS pixels without resizing images", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  const scaled = { ...declaredMetadata(), viewport: { width: 1, height: 1 }, deviceScaleFactor: 2 };
  const result = await compare({ ...f, ...(await metadataPair(f, scaled, scaled)) });
  assert.equal(result.certification, "verified-state");
  assert.equal(result.width, 2);
  assert.equal(result.height, 2);
});

test("invalid JSON metadata and missing metadata files fail without producing artifacts", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  const metadata = await metadataPair(f);
  await writeFile(metadata.referenceMetadataPath, "{");
  await assert.rejects(compare({ ...f, ...metadata }), /metadata|JSON/i);
  await noOutput(f);
  await rm(metadata.referenceMetadataPath);
  await assert.rejects(compare({ ...f, ...metadata }), /metadata|ENOENT/i);
  await noOutput(f);
});

test("different dimensions are rejected rather than scaled to a match", async (t) => {
  const f = await fixture(t, { candidate: { width: 1, height: 2 } });
  const compare = await comparator();
  await assert.rejects(compare(f), /dimension|width|size/i);
  await noOutput(f);
});

for (const [name, contents] of [
  ["non-PNG bytes", Buffer.from("not a PNG")],
  ["truncated PNG", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
]) {
  test(`${name} fail decoding and never report matched`, async (t) => {
    const f = await fixture(t);
    const compare = await comparator();
    await writeFile(f.referencePath, contents);
    await assert.rejects(compare(f), /PNG|decode|reference/i);
    await noOutput(f);
  });
}

test("missing reference is an error, not an invented score", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  await rm(f.referencePath);
  await assert.rejects(compare(f), /reference|ENOENT/i);
  await noOutput(f);
});

for (const [field, value] of [
  ["referencePath", ""],
  ["referencePath", 1],
  ["candidatePath", null],
  ["outputDirectory", "  "],
  ["outputDirectory", null],
]) {
  test(`invalid ${field} path rejects before writing`, async (t) => {
    const f = await fixture(t);
    const compare = await comparator();
    await assert.rejects(compare({ ...f, [field]: value }), new RegExp(field));
    await noOutput(f);
  });
}

test("missing API options fail explicitly", async () => {
  const compare = await comparator();
  await assert.rejects(compare(), /options|referencePath/i);
  await assert.rejects(compare(null), /options|referencePath/i);
});

test("nonempty output and input-containing output directories preserve every input", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  await mkdir(f.outputDirectory);
  const sentinel = join(f.outputDirectory, ".keep");
  await writeFile(sentinel, "must remain unchanged");
  const before = await readFile(f.referencePath);
  await assert.rejects(compare(f), /empty|overwrite|output/i);
  assert.equal(await readFile(sentinel, "utf8"), "must remain unchanged");
  assert.deepEqual(await readdir(f.outputDirectory), [".keep"]);
  await assert.rejects(compare({ ...f, outputDirectory: f.root }), /empty|overwrite|input|output/i);
  assert.deepEqual(await readFile(f.referencePath), before);
});

test("an existing empty output directory is allowed", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  await mkdir(f.outputDirectory);
  const result = await compare(f);
  assert.equal(result.status, "matched");
  assert.deepEqual((await readdir(f.outputDirectory)).sort(), imageFiles);
});

test("output paths equal to images or metadata never overwrite those inputs", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  const metadata = await metadataPair(f);
  for (const input of [
    f.referencePath,
    f.candidatePath,
    metadata.referenceMetadataPath,
    metadata.candidateMetadataPath,
  ]) {
    const before = await readFile(input);
    await assert.rejects(
      compare({ ...f, ...metadata, outputDirectory: input }),
      /output|input|directory|overwrite/i,
    );
    assert.deepEqual(await readFile(input), before);
  }
});

test("symlink output cannot redirect writes into an input or an unrelated directory", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  const empty = join(f.root, "unrelated-empty");
  await mkdir(empty);
  try {
    await symlink(empty, f.outputDirectory, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOSYS"].includes(error.code))
      return t.skip("symlink creation unavailable");
    throw error;
  }
  await assert.rejects(compare(f), /symlink|symbolic|output/i);
  assert.deepEqual(await readdir(empty), []);
  await rm(f.outputDirectory);
  await symlink(f.referencePath, f.outputDirectory, "file");
  const before = await readFile(f.referencePath);
  await assert.rejects(compare(f), /symlink|symbolic|output|directory/i);
  assert.deepEqual(await readFile(f.referencePath), before);
});

test("parallel comparisons cannot overwrite or roll back another completed report", async (t) => {
  const f = await fixture(t, { candidate: oneBlackPixel });
  const compare = await comparator();
  const results = await Promise.allSettled([compare(f), compare(f)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const successful = results.find((result) => result.status === "fulfilled").value;
  assert.deepEqual(
    JSON.parse(await readFile(join(f.outputDirectory, "comparison.json"), "utf8")),
    successful,
  );
  assert.deepEqual((await readdir(f.outputDirectory)).sort(), imageFiles);
  assert.deepEqual((await readdir(f.root)).sort(), [
    "candidate screenshot.png",
    "comparison",
    "reference screenshot.png",
  ]);
});

test("real filesystem output errors do not produce a pass or touch the blocking file", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  const blocking = join(f.root, "not-a-directory");
  await writeFile(blocking, "unchanged");
  await assert.rejects(
    compare({ ...f, outputDirectory: join(blocking, "comparison") }),
    /ENOTDIR|directory|output/i,
  );
  assert.equal(await readFile(blocking, "utf8"), "unchanged");
});

for (const existing of [false, true]) {
  test(`a report write failure cleans partial artifacts and ${existing ? "preserves the existing empty directory" : "rolls back new parent directories"}`, async (t) => {
    const f = await fixture(t);
    const compare = await comparator();
    const outputDirectory = existing
      ? f.outputDirectory
      : join(f.root, "new-parent", "nested", "comparison");
    if (existing) await mkdir(outputDirectory);
    const before = (await readdir(f.root)).sort();
    const originalWrite = fs.writeFile;
    t.mock.method(fs, "writeFile", async function (path, ...args) {
      if (basename(String(path)) === "index.html")
        throw Object.assign(new Error("fixture report write failure"), { code: "EIO" });
      return originalWrite.call(this, path, ...args);
    });
    await assert.rejects(compare({ ...f, outputDirectory }), /fixture report write failure/);
    assert.deepEqual((await readdir(f.root)).sort(), before);
    if (existing) assert.deepEqual(await readdir(outputDirectory), []);
    else await assert.rejects(readdir(outputDirectory), { code: "ENOENT" });
  });
}

test("a publication failure restores a removed preexisting empty directory", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  await mkdir(f.outputDirectory);
  const before = (await readdir(f.root)).sort();
  t.mock.method(fs, "rename", async () => {
    throw Object.assign(new Error("fixture publication failure"), { code: "EIO" });
  });
  await assert.rejects(compare(f), /fixture publication failure/);
  assert.deepEqual(await readdir(f.outputDirectory), []);
  assert.deepEqual((await readdir(f.root)).sort(), before);
});

test("rollback failures retain the original error and explicitly expose cleanup failure", async (t) => {
  const f = await fixture(t);
  const compare = await comparator();
  const originalWrite = fs.writeFile;
  t.mock.method(fs, "writeFile", async function (path, ...args) {
    if (basename(String(path)) === "index.html")
      throw Object.assign(new Error("fixture original write failure"), { code: "EIO" });
    return originalWrite.call(this, path, ...args);
  });
  t.mock.method(fs, "rm", async () => {
    throw Object.assign(new Error("fixture cleanup failure"), { code: "EPERM" });
  });
  await assert.rejects(compare(f), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.message, /cleanup|rollback/i);
    assert.equal(error.cause.code, "EIO");
    assert.ok(error.errors.some((item) => item.code === "EPERM"));
    return true;
  });
  await noOutput(f);
});

test("report escapes labels, reasons and metadata and updates the overlay slider DOM", async (t) => {
  const label =
    process.platform === "win32" ? "reference & 'image'.png" : "reference <tag> & 'image'.png";
  const f = await fixture(t, { referenceName: label, candidate: oneBlackPixel });
  const compare = await comparator();
  const injection =
    '</pre><script>globalThis.__injected = true</script><img id="injected" src="https://example.invalid/leak" onerror="globalThis.__injected = true"> & " \' ';
  const reference = { ...declaredMetadata(), product: injection, source: injection };
  const candidate = { ...declaredMetadata("XBuild fixture"), state: "new-chat" };
  const ignore = [{ x: 0, y: 1, width: 1, height: 1, reason: injection }];
  const result = await compare({ ...f, ...(await metadataPair(f, reference, candidate)), ignore });
  const html = await readFile(result.outputs.html, "utf8");
  assert.ok(!html.includes(injection));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: pathToFileURL(result.outputs.html).href,
  });
  t.after(() => dom.window.close());
  assert.equal(dom.window.__injected, undefined);
  assert.equal(dom.window.document.querySelector("#injected"), null);
  assert.equal(dom.window.document.querySelectorAll("script").length, 1);
  assert.ok(dom.window.document.title.includes(label));
  assert.ok(dom.window.document.body.textContent.includes(injection));
  for (const image of dom.window.document.querySelectorAll("img")) {
    assert.match(image.getAttribute("src"), /^(reference|candidate|overlay|difference)\.png$/);
  }
  assert.match(
    dom.window.document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,
    /connect-src 'none'/,
  );
  const slider = dom.window.document.querySelector('input[type="range"]');
  assert.ok(slider);
  slider.value = "75";
  slider.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  assert.equal(dom.window.document.querySelector("[data-overlay-reference]").style.opacity, "0.25");
  assert.equal(dom.window.document.querySelector("[data-overlay-candidate]").style.opacity, "0.75");
  assert.equal(dom.window.document.querySelector("#overlay-value").textContent, "75% candidate");
});

test("CLI outputs machine-readable matched/different results and exact exit codes", async (t) => {
  const f = await fixture(t, { candidate: oneBlackPixel });
  const different = await invoke(f.root, cliArgs(f));
  assert.equal(different.code, 1, different.stderr);
  assert.equal(different.stderr, "");
  assert.equal(JSON.parse(different.stdout).differenceRatio, 0.25);
  assert.equal(JSON.parse(different.stdout).status, "different");
  const matchedFixture = { ...f, outputDirectory: join(f.root, "masked-cli") };
  const matched = await invoke(f.root, [
    ...cliArgs(matchedFixture),
    "--ignore",
    JSON.stringify([{ x: 1, y: 0, width: 1, height: 1, reason: "Explicit CLI mask" }]),
    "--threshold",
    "0",
    "--max-difference-ratio",
    "0",
  ]);
  assert.equal(matched.code, 0, matched.stderr);
  assert.equal(matched.stderr, "");
  assert.equal(JSON.parse(matched.stdout).status, "matched");
  assert.equal(JSON.parse(matched.stdout).certification, "unverified");
  assert.equal(JSON.parse(matched.stdout).ignoredPixels, 1);
});

test("CLI accepts paired metadata and reports verified-state only for that pair", async (t) => {
  const f = await fixture(t);
  const metadata = await metadataPair(f);
  const result = await invoke(f.root, [
    ...cliArgs(f),
    "--reference-meta",
    metadata.referenceMetadataPath,
    "--candidate-meta",
    metadata.candidateMetadataPath,
  ]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).certification, "verified-state");
});

for (const args of [
  [],
  ["--unknown"],
  ["--reference"],
  ["positional.png"],
  ["--threshold", "NaN"],
  ["--threshold", "Infinity"],
  ["--threshold", "-1"],
  ["--threshold", "1.1"],
  ["--threshold", ""],
  ["--threshold", "0x1"],
  ["--max-difference-ratio", "2"],
  ["--ignore", "{"],
  ["--ignore", "{}"],
  ["--candidate-meta", "missing.json"],
  ["--reference", "missing.png"],
]) {
  test(`CLI rejects invalid arguments ${JSON.stringify(args)} with exit 2 and no score`, async (t) => {
    const f = await fixture(t);
    const fullArgs = args.length === 0 ? args : [...cliArgs(f), ...args];
    const result = await invoke(f.root, fullArgs);
    assert.equal(result.code, 2, result.stderr);
    assert.equal(result.stdout, "");
    assert.ok(result.stderr.trim().length > 0);
    await noOutput(f);
  });
}
