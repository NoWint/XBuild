import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("../../../../../../", import.meta.url));
const entry = "/packages/ui/test/browser/manual-review/pending/preview-card-actions.fixture.tsx";
const artifacts = join(root, "packages/desktop/.e2e-artifacts/preview-card-actions-browser");
let server, browser, origin;
before(async () => {
  await mkdir(artifacts, { recursive: true });
  server = await createServer({
    root,
    // 并行浏览器 fixture 各自拥有预构建缓存，避免模型 fixture 的依赖扫描覆盖当前产物。
    cacheDir: join(artifacts, "vite-cache"),
    configFile: false,
    plugins: [
      {
        name: "preview-card-actions-fixture",
        enforce: "pre",
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith("/fixture?")) return next();
            res.setHeader("Content-Type", "text/html");
            res.end(
              await vite.transformIndexHtml(
                req.url,
                `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`,
              ),
            );
          });
        },
      },
      react(),
      tailwindcss(),
    ],
    resolve: { alias: { "@": `${root}packages/ui/src` } },
    optimizeDeps: { entries: [entry.slice(1)] },
    server: {
      host: "127.0.0.1",
      port: 0,
      hmr: false,
      watch: { ignored: ["**/out/**", "**/dist/**", "**/.e2e-artifacts/**"] },
    },
  });
  await server.listen();
  origin = server.resolvedUrls.local[0];
  browser = await chromium.launch(
    process.env.CHROME_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROME_EXECUTABLE_PATH }
      : { channel: "chrome" },
  );
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const FILE_CARD_TITLE = "项目 简介.docx";
const WEB_CARD_TITLE = "APC Local Preview";

async function openFixture({ width = 1100, theme = "dark", hasTouch = false, surface = "" } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch });
  // 首次访问要冷编译整条 ui 依赖链，放宽默认超时避免误报。
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${origin}fixture?theme=${theme}&locale=zh-CN&surface=${surface}`);
  const fileCard = page.locator(`[data-preview-card-title="${FILE_CARD_TITLE}"]`);
  const webCard = page.locator(`[data-preview-card-title="${WEB_CARD_TITLE}"]`);
  await fileCard.waitFor();
  await webCard.waitFor();
  const readEvents = () => page.getByTestId("preview-events").locator("li").allTextContents();
  return { page, errors, fileCard, webCard, readEvents };
}

test("PCA01 file card body click previews exactly once", async () => {
  const { page, errors, fileCard, readEvents } = await openFixture();
  try {
    // 点卡片左上空白/图标区：命中元素是铺满卡片的透明按钮，一次点击必须只产生一次预览。
    await fileCard.click({ position: { x: 16, y: 28 } });
    assert.deepEqual(await readEvents(), [`codeViewer:${FILE_CARD_TITLE}`]);
    assert.equal(
      await fileCard
        .getByRole("button", { name: `打开 ${FILE_CARD_TITLE}`, exact: true })
        .getAttribute("disabled"),
      null,
    );
  } finally {
    await page.close();
  }
  assert.deepEqual(errors, []);
});

test("PCA02 file card Open button previews exactly once", async () => {
  const { page, errors, fileCard, readEvents } = await openFixture();
  try {
    await fileCard.getByRole("button", { name: "打开", exact: true }).click();
    assert.deepEqual(await readEvents(), [`codeViewer:${FILE_CARD_TITLE}`]);
  } finally {
    await page.close();
  }
  assert.deepEqual(errors, []);
});

test("PCA03 file card dropdown click only expands the menu", async () => {
  const { page, errors, fileCard, readEvents } = await openFixture();
  try {
    await fileCard.getByRole("button", { name: "选择打开方式" }).click();
    const menu = page.locator('[data-slot="dropdown-menu-content"][data-state="open"]');
    await menu.waitFor();
    assert.match(await menu.innerText(), /另存为|Save as/);
    assert.deepEqual(await readEvents(), []);
    await page.screenshot({ path: join(artifacts, "file-card-dropdown.png") });
    await page.keyboard.press("Escape");
  } finally {
    await page.close();
  }
  assert.deepEqual(errors, []);
});

test("PCA04 website card body click and Open button each preview exactly once", async () => {
  const { page, errors, webCard, readEvents } = await openFixture();
  try {
    await webCard.click({ position: { x: 16, y: 28 } });
    assert.deepEqual(await readEvents(), ["browserUrl:http://127.0.0.1:41789/assistant-preview"]);
    await webCard.getByRole("button", { name: "打开", exact: true }).click();
    assert.deepEqual(await readEvents(), [
      "browserUrl:http://127.0.0.1:41789/assistant-preview",
      "browserUrl:http://127.0.0.1:41789/assistant-preview",
    ]);
  } finally {
    await page.close();
  }
  assert.deepEqual(errors, []);
});

test("PCA05 website card dropdown click only expands the menu", async () => {
  const { page, errors, webCard, readEvents } = await openFixture();
  try {
    await webCard.getByRole("button", { name: "选择打开方式" }).click();
    const menu = page.locator('[data-slot="dropdown-menu-content"][data-state="open"]');
    await menu.waitFor();
    assert.match(await menu.innerText(), /在浏览器中打开|Open in browser/);
    assert.deepEqual(await readEvents(), []);
    await page.screenshot({ path: join(artifacts, "web-card-dropdown.png") });
    await page.keyboard.press("Escape");
  } finally {
    await page.close();
  }
  assert.deepEqual(errors, []);
});

test("PCA06 overlay button supports keyboard Enter activation", async () => {
  const { page, errors, fileCard, readEvents } = await openFixture();
  try {
    const overlay = fileCard.getByRole("button", { name: `打开 ${FILE_CARD_TITLE}`, exact: true });
    await overlay.focus();
    await page.keyboard.press("Enter");
    assert.deepEqual(await readEvents(), [`codeViewer:${FILE_CARD_TITLE}`]);
    await overlay.focus();
    await page.keyboard.press("Space");
    assert.deepEqual(await readEvents(), [
      `codeViewer:${FILE_CARD_TITLE}`,
      `codeViewer:${FILE_CARD_TITLE}`,
    ]);
  } finally {
    await page.close();
  }
  assert.deepEqual(errors, []);
});

for (const width of [390, 1200]) {
  for (const theme of ["light", "dark"]) {
    test(`PCA07 artifact and preview frame ${width}/${theme} keep actions inside the rail`, async () => {
      const { page, errors, fileCard } = await openFixture({ width, theme, surface: "preview" });
      try {
        const pane = page.getByTestId("preview-pane");
        await pane.waitFor();
        const geometry = await page.evaluate(() => {
          const card = document.querySelector("[data-preview-card-title]");
          const pane = document.querySelector('[data-testid="preview-pane"]');
          const header = pane.firstElementChild;
          const split = card.querySelector('[data-slot="button"]').parentElement;
          const rect = card.getBoundingClientRect();
          return {
            radius: parseFloat(getComputedStyle(card).borderRadius),
            headerHeight: header.getBoundingClientRect().height,
            splitHeight: split.getBoundingClientRect().height,
            cardContained: rect.left >= 0 && rect.right <= innerWidth,
            overflow: document.documentElement.scrollWidth > innerWidth,
            chevronSize: split.querySelector("svg").getBoundingClientRect().width,
            letterSpacing: getComputedStyle(card).letterSpacing,
          };
        });
        assert.equal(geometry.radius, 8, JSON.stringify(geometry));
        assert.equal(geometry.headerHeight, 36, JSON.stringify(geometry));
        assert.equal(geometry.splitHeight, 28);
        assert.equal(geometry.chevronSize, 16);
        assert.ok(["normal", "0px"].includes(geometry.letterSpacing));
        assert.equal(geometry.cardContained, true);
        assert.equal(geometry.overflow, false);
        await fileCard.getByRole("button", { name: "选择打开方式" }).click();
        await page.getByRole("menu").waitFor();
        await page.keyboard.press("Escape");
        assert.equal(
          await fileCard
            .getByRole("button", { name: "选择打开方式" })
            .evaluate((element) => document.activeElement === element),
          true,
        );
        await page.screenshot({ path: join(artifacts, `frames-${width}-${theme}.png`) });
        assert.deepEqual(errors, []);
      } finally {
        await page.close();
      }
    });
  }
}

test("PCA08 context removal is discoverable from keyboard focus and activates exactly once", async () => {
  const { page, errors, readEvents } = await openFixture();
  try {
    const pill = page.getByRole("button", { name: "Context attachment", exact: true });
    const remove = page.getByRole("button", { name: "Remove context", exact: true });
    await pill.focus();
    await remove.evaluate(async (element) => {
      await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
    });
    assert.equal(await remove.evaluate((element) => getComputedStyle(element).opacity), "1");
    await remove.focus();
    await page.keyboard.press("Enter");
    await pill.waitFor({ state: "detached" });
    assert.deepEqual(await readEvents(), ["removeContext"]);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test("PCA09 context removal is discoverable on touch without hover", async () => {
  const { page, errors, readEvents } = await openFixture({ width: 390, hasTouch: true });
  try {
    assert.equal(await page.evaluate(() => matchMedia("(hover: none)").matches), true);
    const remove = page.getByRole("button", { name: "Remove context", exact: true });
    assert.equal(await remove.evaluate((element) => getComputedStyle(element).opacity), "1");
    await remove.tap();
    assert.deepEqual(await readEvents(), ["removeContext"]);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
