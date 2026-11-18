import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { compareDesktopImages } from "../desktop-ui-visual-compare.mjs";

const requireAdapters = createRequire(
  new URL("../../apps/zcode-cli/packages/adapters/package.json", import.meta.url),
);
const { Jimp } = requireAdapters("jimp");

async function literalPng(pixels) {
  const image = new Jimp({ width: 2, height: 2, color: 0xffffffff });
  for (const [x, y, rgba] of pixels) image.bitmap.data.set(rgba, (y * 2 + x) * 4);
  return image.getBuffer("image/png");
}

function pixel(image, x, y) {
  const offset = (y * image.bitmap.width + x) * 4;
  return [...image.bitmap.data.subarray(offset, offset + 4)];
}

test(
  "real Chromium renders premultiplied overlay alpha at 0/50/100 without leaking the reference",
  { skip: !process.env.DESKTOP_UI_VISUAL_BROWSER_PATH },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), "desktop-ui-visual-browser-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const referencePath = join(root, "reference.png");
    const candidatePath = join(root, "candidate.png");
    await writeFile(
      referencePath,
      await literalPng([
        [1, 0, [0, 0, 0, 255]],
        [0, 1, [255, 0, 0, 255]],
      ]),
    );
    await writeFile(
      candidatePath,
      await literalPng([
        [1, 0, [255, 255, 255, 128]],
        [0, 1, [0, 255, 0, 0]],
      ]),
    );
    const result = await compareDesktopImages({
      referencePath,
      candidatePath,
      outputDirectory: join(root, "comparison"),
    });
    assert.deepEqual(
      pixel(await Jimp.read(await readFile(result.outputs.overlay)), 1, 0),
      [85, 85, 85, 192],
    );
    const requireDesktop = createRequire(
      new URL("../../packages/desktop/package.json", import.meta.url),
    );
    const { chromium } = requireDesktop("playwright-core");
    const browser = await chromium.launch({
      executablePath: process.env.DESKTOP_UI_VISUAL_BROWSER_PATH,
    });
    t.after(() => browser.close());
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const errors = [];
    const remoteRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (!request.url().startsWith("file:")) remoteRequests.push(request.url());
    });
    await page.goto(pathToFileURL(result.outputs.html).href);
    assert.match(
      await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content"),
      /connect-src 'none'/,
    );
    await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
    await page.addStyleTag({
      content: ".blend { width: 2px; height: 2px; border: 0; aspect-ratio: auto; }",
    });
    const blend = page.locator(".blend");
    const reportMidpoint = await Jimp.read(await blend.screenshot());
    const transparentStyle = await page.addStyleTag({
      content:
        "html,body { background: transparent !important; } .image-surface { background: none !important; }",
    });
    const render = async (value) => {
      await page.locator("#overlay-opacity").evaluate((slider, candidateWeight) => {
        slider.value = String(candidateWeight);
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      }, value);
      return Jimp.read(await blend.screenshot({ omitBackground: true }));
    };
    const midpoint = await render(50);
    assert.deepEqual(pixel(midpoint, 1, 0), [85, 85, 85, 192]);
    assert.deepEqual(pixel(midpoint, 0, 1), [255, 0, 0, 128]);
    const reference = await render(0);
    assert.deepEqual(pixel(reference, 1, 0), [0, 0, 0, 255]);
    assert.deepEqual(pixel(reference, 0, 1), [255, 0, 0, 255]);
    const candidate = await render(100);
    assert.deepEqual(pixel(candidate, 1, 0), [255, 255, 255, 128]);
    assert.deepEqual(pixel(candidate, 0, 1), [0, 0, 0, 0]);
    await transparentStyle.evaluate((style) => style.remove());
    await blend.evaluate(async (surface) => {
      const overlay = document.createElement("img");
      overlay.src = "overlay.png";
      overlay.alt = "Downloaded overlay";
      surface.replaceChildren(overlay);
      await overlay.decode();
    });
    const downloadedMidpoint = await Jimp.read(await blend.screenshot());
    assert.deepEqual(reportMidpoint.bitmap.data, downloadedMidpoint.bitmap.data);
    assert.deepEqual(errors, []);
    assert.deepEqual(remoteRequests, []);
  },
);
