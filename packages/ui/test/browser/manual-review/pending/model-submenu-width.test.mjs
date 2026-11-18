import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("../../../../../../", import.meta.url));
const entry = "/packages/ui/test/browser/manual-review/pending/model-submenu-width.fixture.tsx";
const artifacts = join(tmpdir(), "zcode-model-submenu-width");
let server;
let browser;
let origin;

before(async () => {
  server = await createServer({
    root,
    // 原因：共用默认缓存的并行运行出现空 DOM 且无 pageerror，单独运行正常。
    // fixture 独立持有预构建缓存，消除同时重建同一份产物的写入竞争。
    cacheDir: join(artifacts, "vite-cache"),
    configFile: false,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "responsive-fixture",
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith("/fixture?")) return next();
            res.setHeader("Content-Type", "text/html");
            res.end(
              await vite.transformIndexHtml(
                req.url,
                `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`,
              ),
            );
          });
        },
      },
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

async function reportPageFailure(context, page, errors) {
  context.diagnostic(
    JSON.stringify({
      url: page.url(),
      pageErrors: errors,
      body: await page.locator("body").innerText(),
      root: await page.locator("#root").innerHTML(),
      activeElement: await page.evaluate(() => document.activeElement?.outerHTML),
    }),
  );
}

for (const width of [390, 1200]) {
  for (const theme of ["light", "dark"]) {
    for (const name of ["short", "long", "extreme"]) {
      test(`model submenu ${width}/${theme}/${name}`, async (context) => {
        const page = await browser.newPage({ viewport: { width, height: 700 } });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await page.goto(`${origin}fixture?theme=${theme}&name=${name}`);
          await page.getByRole("button", { name: "Models", exact: true }).click();
          const provider = page.locator("[data-model-provider-key=custom]");
          await provider.focus();
          await page.keyboard.press("ArrowRight");
          const menu = page.locator('[data-slot="dropdown-menu-sub-content"]');
          await menu.waitFor();
          await menu.evaluate(async (element) => {
            await Promise.allSettled(
              element.getAnimations().map((animation) => animation.finished),
            );
          });
          // Radix 在内容测量后更新碰撞位置；等待定位与入场动画完成再检查几何边界。
          await page.waitForFunction(() => {
            const element = document.querySelector('[data-slot="dropdown-menu-sub-content"]');
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            return (
              rect.left >= 0 &&
              rect.right <= innerWidth &&
              element.getAnimations().every((animation) => animation.playState !== "running")
            );
          });
          const label = menu.locator("span[title]").filter({ hasText: "GLM" }).last();
          const metrics = await label.evaluate((element) => {
            const menu = element.closest('[data-slot="dropdown-menu-sub-content"]');
            const rect = menu.getBoundingClientRect();
            return {
              width: rect.width,
              left: rect.left,
              right: rect.right,
              clipped: element.scrollWidth > element.clientWidth,
              overflow: menu.scrollWidth > menu.clientWidth,
            };
          });
          assert.ok(metrics.left >= 0 && metrics.right <= width, JSON.stringify(metrics));
          assert.equal(metrics.overflow, false);
          if (width === 1200 && name !== "extreme") {
            assert.ok(metrics.width >= 192);
            assert.equal(metrics.clipped, false, JSON.stringify(metrics));
            if (name === "long") assert.ok(metrics.width > 192);
          }
          context.diagnostic(JSON.stringify({ width, theme, name, metrics }));
          await mkdir(artifacts, { recursive: true });
          await page.screenshot({ path: join(artifacts, `${width}-${theme}-${name}.png`) });
          const firstModel = menu.getByRole("menuitemradio").first();
          const lastModel = menu.getByRole("menuitemradio").last();
          await firstModel.focus();
          await page.keyboard.press("ArrowDown");
          // Radix roving-focus 用下一轮任务迁移焦点；等待真实目标，不能同步读取旧焦点。
          await page.waitForFunction(
            (element) => document.activeElement === element,
            await lastModel.elementHandle(),
          );
          assert.equal(
            await lastModel.evaluate((element) => document.activeElement === element),
            true,
          );
          await page.keyboard.press("ArrowLeft");
          await menu.waitFor({ state: "hidden" });
          assert.equal(
            await provider.evaluate((element) => document.activeElement === element),
            true,
          );
          assert.equal(await page.getByTestId("selected").textContent(), "text");
          await page.keyboard.press("ArrowRight");
          await menu.waitFor();
          await menu.getByRole("menuitemradio").last().click();
          await page.getByTestId("selected").filter({ hasText: "vision" }).waitFor();
          assert.deepEqual(errors, []);
        } catch (error) {
          await reportPageFailure(context, page, errors);
          throw error;
        } finally {
          await page.close();
        }
      });
    }
  }
}

for (const width of [390, 1200]) {
  for (const theme of ["light", "dark"]) {
    test(`combined model control ${width}/${theme} preserves draft, effort and menu focus`, async (context) => {
      const page = await browser.newPage({ viewport: { width, height: 700 } });
      page.setDefaultTimeout(60_000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await page.goto(`${origin}fixture?theme=${theme}&name=extreme&combined=true`);
        const trigger = page.getByTestId("chat-model-select-trigger");
        const geometry = await trigger.evaluate((element) => ({
          right: element.getBoundingClientRect().right,
          iconSizes: Array.from(element.querySelectorAll("svg")).map(
            (icon) => icon.getBoundingClientRect().width,
          ),
          documentOverflow: document.documentElement.scrollWidth > innerWidth,
        }));
        assert.equal(geometry.documentOverflow, false, JSON.stringify(geometry));
        assert.ok(geometry.right <= width, JSON.stringify(geometry));
        assert.ok(
          geometry.iconSizes.every((size) => size === 16),
          JSON.stringify(geometry),
        );
        await trigger.click();
        const menu = page.getByRole("menu").first();
        await menu.getByRole("menuitemradio").last().click();
        await page.getByTestId("selected").filter({ hasText: "vision" }).waitFor();
        assert.equal(await menu.isVisible(), true);
        const effort = menu.getByRole("slider", { name: "Effort" });
        await effort.focus();
        await page.keyboard.press("ArrowRight");
        await page.getByTestId("effort").filter({ hasText: "high" }).waitFor();
        assert.equal(await effort.evaluate((element) => document.activeElement === element), true);
        await page.keyboard.press("Escape");
        await menu.waitFor({ state: "hidden" });
        assert.equal(await page.locator("#composer-draft").inputValue(), "Unsent draft");
        if (width === 1200) {
          assert.equal(
            await page
              .locator("#composer-draft")
              .evaluate((element) => document.activeElement === element),
            true,
          );
        }
        assert.deepEqual(errors, []);
      } catch (error) {
        await reportPageFailure(context, page, errors);
        throw error;
      } finally {
        await page.close();
      }
    });
  }
}

test("disabled combined model control does not open or change configuration", async (context) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${origin}fixture?theme=light&name=long&combined=true&disabled=true`);
    const trigger = page.getByTestId("chat-model-select-trigger");
    await trigger.waitFor();
    assert.equal(await trigger.isDisabled(), true);
    assert.equal(await page.getByRole("menu").count(), 0);
    assert.equal(await page.getByTestId("selected").textContent(), "text");
    assert.equal(await page.getByTestId("effort").textContent(), "low");
    assert.equal(await page.locator("#composer-draft").inputValue(), "Unsent draft");
    assert.deepEqual(errors, []);
  } catch (error) {
    await reportPageFailure(context, page, errors);
    throw error;
  } finally {
    await page.close();
  }
});
