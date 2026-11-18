import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("../../../../../../", import.meta.url));
const entry =
  "/packages/ui/test/browser/manual-review/pending/claude-desktop-design-system.fixture.tsx";
const artifacts = join(root, "packages/desktop/.e2e-artifacts/claude-desktop-design-system");
let server;
let browser;
let origin;

before(async () => {
  await mkdir(artifacts, { recursive: true });
  server = await createServer({
    root,
    configFile: false,
    cacheDir: join(artifacts, "vite-cache"),
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "desktop-design-acceptance",
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
    resolve: { alias: { "@": join(root, "packages/ui/src") } },
    optimizeDeps: {
      entries: [entry.slice(1)],
      include: [
        "@pierre/diffs",
        "@pierre/diffs/react",
        "@pierre/diffs/worker/worker.js",
        "@streamdown/cjk",
        "@streamdown/code",
        "@streamdown/math",
        "@streamdown/mermaid",
        "motion/react",
        "remark-cjk-friendly-gfm-strikethrough",
        "streamdown",
      ],
    },
    server: { host: "127.0.0.1", port: 0, hmr: false },
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

for (const theme of ["light", "dark"]) {
  for (const kind of ["disabled-only menu", "popover", "dialog"]) {
    for (const forcedColors of ["none", "active"]) {
      test(
        `CDR-DS-05: ${kind} actual content-root focus retains shadow ${theme}/${forcedColors}`,
        { timeout: 120000 },
        async () => {
          const page = await browser.newPage({
            viewport: { width: 1200, height: 800 },
            forcedColors,
            reducedMotion: "reduce",
          });
          try {
            await page.goto(`${origin}fixture?theme=${theme}`);
            const names = {
              "disabled-only menu": "Unavailable options",
              popover: "Open popover",
              dialog: "Open dialog",
            };
            const trigger = page.getByRole("button", { name: names[kind], exact: true });
            await trigger.focus();
            await page.keyboard.press("Enter");
            const content =
              kind === "popover"
                ? page.locator('[data-slot="popover-content"]')
                : page.getByRole(kind === "dialog" ? "dialog" : "menu");
            await content.waitFor();
            await content.evaluate((el) =>
              Promise.all(
                el.getAnimations().map((animation) => animation.finished.catch(() => {})),
              ),
            );
            if (kind === "disabled-only menu") {
              assert.ok(
                await content.evaluate((el) => el === document.activeElement),
                "without an enabled item the real menu must naturally retain root focus",
              );
            }
            const facts = await content.evaluate((el) => {
              el.focus();
              const probe = document.createElement("span");
              probe.style.boxShadow = "var(--desktop-shadow-popover)";
              document.body.appendChild(probe);
              const expectedShadow = getComputedStyle(probe).boxShadow;
              probe.remove();
              return {
                focused: document.activeElement === el,
                focusVisible: el.matches(":focus-visible"),
                shadow: getComputedStyle(el).boxShadow,
                expectedShadow,
                outline: getComputedStyle(el).outlineStyle,
              };
            });
            await writeFile(
              join(artifacts, `root-focus-${kind}-${theme}-${forcedColors}.json`),
              JSON.stringify(facts, null, 2),
            );
            assert.ok(facts.focused && facts.focusVisible, JSON.stringify(facts));
            // 原生强制色会主动抑制阴影；记录其 computed 值，不覆盖 UA 行为来制造失败。
            if (forcedColors === "none") {
              assert.equal(
                facts.shadow,
                facts.expectedShadow,
                `${kind} shared shadow must survive actual content-root keyboard focus: ${JSON.stringify(facts)}`,
              );
            }
            assert.equal(facts.outline, "none", "shadow repair must not add a global outline");
            await content.screenshot({
              path: join(artifacts, `root-focus-${kind}-${theme}-${forcedColors}.png`),
              animations: "disabled",
            });
            await page.keyboard.press("Escape");
            await content.waitFor({ state: "hidden" });
            assert.ok(await trigger.evaluate((el) => el === document.activeElement));
          } finally {
            await page.close();
          }
        },
      );
    }
  }

  for (const width of [390, 768, 1200]) {
    test(`CDR-DS-01: actual shared components ${theme}/${width}`, { timeout: 120000 }, async () => {
      const page = await browser.newPage({
        viewport: { width, height: 800 },
        deviceScaleFactor: 1,
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      try {
        await page.goto(
          `${origin}fixture?theme=${theme}&locale=${width === 390 ? "zh-CN" : "en-US"}`,
        );
        await page.getByTestId("primary-action").waitFor();
        const facts = await page.evaluate(() => {
          const main = document.querySelector("main");
          const greeting = document.querySelector("[data-v4-draft-greeting]");
          const rail = document.querySelector(".xb-reading-rail");
          const rect = rail.getBoundingClientRect();
          return {
            surface: getComputedStyle(main).backgroundColor,
            railWidth: rect.width,
            railLeft: rect.left,
            railRight: rect.right,
            greetingFont: getComputedStyle(greeting).fontFamily,
            greetingFontSize: Number.parseFloat(getComputedStyle(greeting).fontSize),
            greetingLetterSpacing:
              getComputedStyle(greeting).letterSpacing === "normal"
                ? 0
                : Number.parseFloat(getComputedStyle(greeting).letterSpacing),
            greetingWidth: greeting.getBoundingClientRect().width,
            greetingScrollWidth: greeting.scrollWidth,
            rootOverflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        await page.screenshot({ path: join(artifacts, `${theme}-${width}.png`) });
        await writeFile(join(artifacts, `${theme}-${width}.json`), JSON.stringify(facts, null, 2));
        assert.deepEqual(errors, []);
        assert.equal(
          facts.surface,
          theme === "light" ? "rgb(252, 252, 251)" : "rgb(21, 21, 21)",
          "ordinary app panels must not remain transparent native material",
        );
        assert.ok(
          facts.railWidth <= 768.5,
          "reading rail must be capped at the researched default measure",
        );
        assert.ok(
          facts.railLeft >= 0 && facts.railRight <= width + 1,
          "reading rail must fit the actual viewport",
        );
        assert.match(
          facts.greetingFont,
          /Georgia|serif/i,
          "real new-draft greeting must use the documented voice role, not branded background art",
        );
        assert.equal(
          facts.greetingFontSize,
          32,
          "resizing the main draft must not scale its voice role",
        );
        assert.equal(
          facts.greetingLetterSpacing,
          0,
          "voice text must retain uncompressed letter spacing",
        );
        assert.ok(
          facts.greetingScrollWidth <= facts.greetingWidth + 1,
          "localized greeting must not overflow",
        );
        assert.equal(facts.rootOverflow, false);
        await page.getByTestId("primary-action").click();
        assert.equal(await page.getByTestId("action-result").textContent(), "primary");
      } finally {
        await page.close();
      }
    });
  }

  test(`CDR-DS-02: menu and dialog focus/shadow ${theme}`, { timeout: 120000 }, async () => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    try {
      await page.goto(`${origin}fixture?theme=${theme}`);
      const trigger = page.getByTestId("menu-trigger");
      await trigger.focus();
      await page.keyboard.press("Enter");
      const menu = page.getByRole("menu");
      await menu.waitFor();
      assert.notEqual(
        await menu.evaluate((el) => getComputedStyle(el).boxShadow),
        "none",
        "focus reset must not erase the overlay shadow",
      );
      await page.keyboard.press("Escape");
      await menu.waitFor({ state: "hidden" });
      assert.ok(
        await trigger.evaluate((el) => el === document.activeElement),
        "menu closing must restore its trigger focus",
      );
      await page.getByRole("button", { name: "Open dialog", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      await page.getByRole("textbox", { name: "Dialog name" }).fill("Keyboard remains usable");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.ok(
        await page
          .getByRole("button", { name: "Open dialog", exact: true })
          .evaluate((el) => el === document.activeElement),
      );
    } finally {
      await page.close();
    }
  });
}

test("CDR-DS-03: reduced motion and UI font preserve geometry", { timeout: 120000 }, async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
    reducedMotion: "reduce",
  });
  try {
    await page.goto(`${origin}fixture?theme=light`);
    await page.getByTestId("primary-action").waitFor();
    const read = () =>
      page.evaluate(() => ({
        html: getComputedStyle(document.documentElement).fontSize,
        rail: document.querySelector(".xb-reading-rail").getBoundingClientRect().width,
        font: getComputedStyle(document.querySelector('[data-testid="primary-action"]')).fontSize,
        duration: getComputedStyle(document.querySelector('[data-testid="primary-action"]'))
          .transitionDuration,
      }));
    const initial = await read();
    await page.evaluate(() => document.documentElement.style.setProperty("--ui-font-size", "18px"));
    const changed = await read();
    assert.equal(changed.html, initial.html);
    assert.equal(changed.rail, initial.rail);
    assert.notEqual(changed.font, initial.font);
    assert.ok(
      changed.duration.split(",").every((value) => parseFloat(value) <= 0.01),
      "reduced-motion must end purely presentational transitions",
    );
    const status = page.getByTestId("motion-status").locator("span").first();
    assert.ok(
      await status.evaluate((element) =>
        getComputedStyle(element)
          .backgroundPosition.split(",")
          .every((position) => Number.parseFloat(position) === 0),
      ),
      "reduced-motion status text must remain in its static visible position",
    );
    assert.equal(
      await status.evaluate(
        (element) =>
          element.getAnimations().filter((animation) => animation.playState === "running").length,
      ),
      0,
    );
  } finally {
    await page.close();
  }
});

for (const theme of ["light", "dark"]) {
  test(
    `CDR-DS-04: actual Markdown uses reading roles without scaling code ${theme}`,
    { timeout: 120000 },
    async () => {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      try {
        await page.goto(`${origin}fixture?theme=${theme}`);
        const surface = page.getByTestId("markdown-surface");
        await surface.locator("p").first().waitFor();
        const read = () =>
          surface.evaluate((element) => {
            const paragraph = element.querySelector("p");
            const heading = element.querySelector("h2");
            if (!paragraph || !heading) throw new Error("Actual Markdown content missing");
            const paragraphStyle = getComputedStyle(paragraph);
            return {
              font: Number.parseFloat(paragraphStyle.fontSize),
              line: Number.parseFloat(paragraphStyle.lineHeight),
              tracking:
                paragraphStyle.letterSpacing === "normal"
                  ? 0
                  : Number.parseFloat(paragraphStyle.letterSpacing),
              headingWeight: getComputedStyle(heading).fontWeight,
              fits: element.scrollWidth <= element.getBoundingClientRect().width + 1,
            };
          });
        const initial = await read();
        assert.equal(
          initial.font,
          15,
          "the actual response must not override its reading role with compact UI text",
        );
        assert.equal(initial.line, 21);
        assert.equal(initial.tracking, 0);
        assert.equal(initial.headingWeight, "580");
        assert.equal(initial.fits, true);
        // CodeViewer uses an open shadow tree; Playwright's locator pierces that boundary.
        const code = surface.locator("pre code").first();
        await code.waitFor();
        const codeFont = await code.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        );
        assert.equal(
          codeFont,
          14,
          await code.evaluate((element) =>
            JSON.stringify({
              tag: element.tagName,
              className: element.className,
              parent: element.parentElement?.outerHTML.slice(0, 2000),
            }),
          ),
        );
        await page.evaluate(() =>
          document.documentElement.style.setProperty("--ui-font-size", "18px"),
        );
        const changed = await read();
        assert.equal(changed.font, 19);
        assert.equal(
          await code.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
          codeFont,
          "independent code preference must survive UI font scaling",
        );
      } finally {
        await page.close();
      }
    },
  );
}
