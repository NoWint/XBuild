import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("../../../../../../", import.meta.url));
const entry = "/packages/ui/test/browser/manual-review/pending/sidebar-user-id.fixture.tsx";
const artifacts = "/tmp/zcode-sidebar-user-id";
let server, browser, origin;
before(async () => {
  await mkdir(artifacts, { recursive: true });
  server = await createServer({
    root,
    configFile: false,
    cacheDir: `${artifacts}/vite-cache`,
    plugins: [
      {
        name: "footer-fixture-boundaries",
        load(id) {
          if (id.endsWith("/hooks/usePlatform.tsx"))
            return "export const usePlatform=()=>({executeDesktopCommand:async()=>{}}); export const useOptionalPlatform=()=>null; export const PlatformProvider=({children})=>children;";
          if (id.endsWith("/hooks/useGlobalTaskList.ts"))
            return "const items=[]; export const useGlobalTaskList=()=>({items,loading:false});";
          if (id.endsWith("/hooks/useServices.tsx"))
            return 'export const useServices=()=>({fileService:{}}); export const useOptionalServices=()=>null; export const useTerminalOwnerId=()=>undefined; export const useComposerClientNamespace=()=>"fixture"; export const ServiceProvider=({children})=>children;';
          if (id.endsWith("/rewards/RewardsProvider.tsx"))
            return "export const useOpenRewards=()=>()=>{};";
          if (id.endsWith("/shortcuts/useShortcutBindings.ts"))
            return 'export const useShortcutCommandLabel=()=>""; export const useEffectiveShortcutBindings=()=>({});';
          if (id.endsWith("/store/StoreProvider.tsx"))
            return 'import {createContext} from "react"; export const StoreContext=createContext(null); export const StoreProvider=({children})=>children; export const useZCodeStore=(select)=>select({interfaceMode:"coding",setInterfaceMode:()=>{},isRestoringOAuthSession:false}); export const useZCodeStoreWithDefault=(_select,fallback)=>fallback;';
          if (id.endsWith("/WorkspaceWebRemoteControlTrigger.tsx"))
            return "export const WorkspaceWebRemoteControlTrigger=()=>null;";
          if (id.endsWith("/WorkspaceSidebarFooterUsageSummary.tsx"))
            return 'import React from "react"; export const useWorkspaceSidebarFooterUsageSummaryState=()=>({}); export const WorkspaceSidebarFooterPlanBadge=()=>React.createElement("span",{className:"rounded-full border border-border bg-surface px-1 py-px text-ui-xs text-foreground-subtle"},"Pro"); export const WorkspaceSidebarFooterUsageSummaryContent=()=>null;';
        },
      },
      react(),
      tailwindcss(),
      {
        name: "footer-page",
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
  for (const width of [960, 390]) {
    test(`真实 New Task 导航组及子操作几何与原创建动作 ${theme} width=${width}`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      try {
        await page.goto(`${origin}fixture?theme=${theme}&surface=navigation&locale=en-US`);
        const navigation = page.getByTestId("sidebar-primary-navigation");
        const group = navigation.getByRole("group");
        await group.waitFor();
        const facts = await group.evaluate((el) => {
          const action = el.firstElementChild;
          return {
            groupHeight: el.getBoundingClientRect().height,
            actionHeight: action.getBoundingClientRect().height,
            labelSize: parseFloat(getComputedStyle(action.querySelector("span")).fontSize),
            iconSize: parseFloat(getComputedStyle(action.querySelector("svg")).width),
            fits: el.getBoundingClientRect().right <= innerWidth,
          };
        });
        assert.equal(facts.groupHeight, width === 960 ? 26 : 44, JSON.stringify(facts));
        assert.equal(facts.actionHeight, facts.groupHeight, JSON.stringify(facts));
        assert.equal(facts.labelSize, width === 960 ? 13 : 14);
        assert.equal(facts.iconSize, 16);
        assert.ok(facts.fits);
        await group.locator("span").first().click();
        assert.equal(await page.getByTestId("fixture-action").textContent(), "navigation:create");
        assert.equal(await page.getByTestId("create-count").textContent(), "1");
        await page.getByRole("region", { name: "Disabled New Task" }).getByRole("group").click({
          force: true,
        });
        assert.equal(await page.getByTestId("create-count").textContent(), "1");
        assert.equal(await page.getByTestId("fixture-action").textContent(), "navigation:create");
        const actions = navigation.locator('[data-slot="button"]');
        assert.equal(await actions.count(), 2);
        for (const action of await actions.all()) {
          assert.equal(
            (await action.boundingBox()).height,
            width === 960 ? 26 : 44,
            "other real navigation actions retain the same compact/touch geometry",
          );
        }
        await actions.nth(0).click();
        assert.equal(
          await page.getByTestId("fixture-action").textContent(),
          "navigation:automations",
        );
        await actions.nth(1).click();
        assert.equal(await page.getByTestId("fixture-action").textContent(), "navigation:plugins");
        await navigation.screenshot({ path: `${artifacts}/navigation-${theme}-${width}.png` });
      } finally {
        await page.close();
      }
    });

    test(`真实字标文本零字距 ${theme} width=${width}`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      try {
        await page.goto(`${origin}fixture?theme=${theme}&surface=navigation&locale=en-US`);
        const wordmarkText = page.locator(".xb-sidebar-wordmark > span");
        await wordmarkText.waitFor();
        const tracking = await wordmarkText.evaluate((el) => {
          const value = getComputedStyle(el).letterSpacing;
          return value === "normal" ? 0 : parseFloat(value);
        });
        assert.equal(tracking, 0, "the actual text cannot override the zero wordmark role");
      } finally {
        await page.close();
      }
    });
  }

  for (const device of ["0", "1"]) {
    test(`真实手机远控导航保留安全区与设备入口 ${theme} device=${device}`, async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
      try {
        await page.goto(
          `${origin}fixture?theme=${theme}&surface=navigation&remote=1&device=${device}&locale=en-US`,
        );
        const navigation = page.getByTestId("sidebar-primary-navigation");
        await navigation.waitFor();
        assert.equal(
          await navigation.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop)),
          device === "0" ? 44 : 12,
          "only remote navigation without the device row reserves original top controls",
        );
        assert.equal(await navigation.locator(".xb-sidebar-wordmark").count(), 0);
        const group = navigation.getByRole("group");
        assert.equal((await group.boundingBox()).height, 44);
        assert.equal(
          await navigation.locator('[data-testid="plugin-store-sidebar-open"]').count(),
          0,
        );
        if (device === "0") {
          const topButton = page.getByRole("button", { name: "New task", exact: true });
          const topBounds = await topButton.boundingBox();
          const newTaskBounds = await group.boundingBox();
          assert.ok(newTaskBounds.y >= topBounds.y + topBounds.height);
          await topButton.click();
          assert.equal(
            await page.getByTestId("fixture-action").textContent(),
            "navigation:top-create",
          );
        } else {
          const switchDevice = navigation.getByRole("button", {
            name: "Switch device",
            exact: true,
          });
          assert.equal((await switchDevice.boundingBox()).height, 44);
          await switchDevice.click();
          assert.equal(await page.getByTestId("fixture-action").textContent(), "navigation:device");
        }
        await group.click();
        assert.equal(await page.getByTestId("fixture-action").textContent(), "navigation:create");
        assert.equal(await page.getByTestId("create-count").textContent(), "1");
        await page.screenshot({ path: `${artifacts}/remote-navigation-${theme}-${device}.png` });
      } finally {
        await page.close();
      }
    });
  }
}

async function open(params = {}, clipboard = "ok", width = 960) {
  const page = await browser.newPage({ viewport: { width, height: 680 } });
  page.setDefaultTimeout(10_000);
  await page.addInitScript((mode) => {
    window.copiedValues = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value:
        mode === "missing"
          ? undefined
          : {
              writeText: async (value) => {
                if (mode === "reject") throw new Error("denied");
                window.copiedValues.push(value);
              },
            },
    });
  }, clipboard);
  await page.goto(`${origin}fixture?${new URLSearchParams(params)}`);
  const trigger = page.getByRole("button", {
    name: params.guest === "1" ? "连接使用" : (params.name ?? "Alex").trim(),
    exact: true,
  });
  await trigger.waitFor();
  assert.equal(await trigger.getByText("Pro", { exact: true }).count(), 0);
  await trigger.click();
  return page;
}

for (const theme of ["light", "dark"])
  for (const width of [960, 390])
    test(`长名称不撑宽、账户焦点和动作保留 ${theme} width=${width}`, async () => {
      const name = "Alexandra ".repeat(24);
      const page = await open({ theme, name, mobile: width === 390 ? "1" : "0" }, "ok", width);
      try {
        const trigger = page.getByRole("button", { name: name.trim(), exact: true });
        assert.equal(await page.getByTestId("profile-menu-name").innerText(), name.trim());
        assert.ok(
          await page
            .getByTestId("profile-menu-name")
            .evaluate((el) => el.scrollWidth > el.clientWidth),
        );
        const menuBounds = await page.getByRole("menu").boundingBox();
        assert.ok(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= width);
        assert.equal(
          await page.getByRole("menuitem", { name: "界面语言", exact: true }).count(),
          1,
        );
        assert.equal(
          await page.getByRole("menuitem", { name: "界面主题", exact: true }).count(),
          1,
        );
        assert.equal(
          await page.getByRole("menuitem", { name: "界面模式", exact: true }).count(),
          1,
        );
        assert.equal(
          await page.getByRole("menuitem", { name: "断开连接", exact: true }).count(),
          1,
        );
        await page.keyboard.press("Escape");
        assert.ok(await trigger.evaluate((el) => el === document.activeElement));
        const geometry = await trigger.evaluate((el) => ({
          focused: el === document.activeElement,
          focusVisible: el.matches(":focus-visible"),
          borderWidth: getComputedStyle(el).borderTopWidth,
          borderColor: getComputedStyle(el).borderTopColor,
          expectedBorderColor: getComputedStyle(document.documentElement)
            .getPropertyValue("--color-input-border-focused")
            .trim(),
          height: el.getBoundingClientRect().height,
          fits:
            document.documentElement.scrollWidth <= innerWidth &&
            el.getBoundingClientRect().right <= innerWidth,
        }));
        assert.ok(geometry.focused && geometry.focusVisible);
        assert.equal(geometry.borderWidth, "1px");
        assert.notEqual(geometry.borderColor, "rgba(0, 0, 0, 0)");
        assert.ok(geometry.fits);
        if (width === 390) assert.ok(geometry.height >= 44);
        await page.keyboard.press("Enter");
        await page.getByRole("menu").waitFor();
        await page.getByRole("menuitem", { name: "断开连接", exact: true }).click();
        await page.getByRole("menu").waitFor({ state: "hidden" });
        assert.equal(await page.getByTestId("fixture-action").innerText(), "logout");
        await page.getByRole("button", { name: "设置", exact: true }).click();
        assert.equal(await page.getByTestId("fixture-action").innerText(), "settings");
        await page.screenshot({ path: `${artifacts}/account-long-${theme}-${width}.png` });
      } finally {
        await page.close();
      }
    });

for (const theme of ["light", "dark"])
  for (const width of [960, 390])
    test(`真实项目任务行 compact 与触控、长标题和原动作 ${theme} width=${width}`, async () => {
      const page = await open(
        { theme, surface: "rows", mobile: width === 390 ? "1" : "0" },
        "ok",
        width,
      );
      try {
        await page.keyboard.press("Escape");
        const task = page.getByTestId("task-item-fixture-task");
        await task.waitFor();
        const geometry = await page.evaluate(() => {
          const project = document.querySelector('[data-testid="virtual-project-row"]');
          const toggle = document.querySelector('[data-testid="virtual-project-toggle"]');
          const task = document.querySelector('[data-testid="task-item-fixture-task"]');
          const timeline = document.querySelector('[data-testid="task-item-timeline-task"]');
          const workflow = document.querySelector('[data-testid="task-item-workflow-task"]');
          const title = task.querySelector('[data-task-title-copy="original"]');
          return {
            projectHeight: project.getBoundingClientRect().height,
            toggleHeight: toggle.getBoundingClientRect().height,
            taskHeight: task.getBoundingClientRect().height,
            timelineHeight: timeline.getBoundingClientRect().height,
            workflowHeight: workflow.getBoundingClientRect().height,
            actionIconSize: parseFloat(
              getComputedStyle(project.querySelector('[data-testid="virtual-project-menu"] svg'))
                .width,
            ),
            titleSize: parseFloat(getComputedStyle(title).fontSize),
            titleOverflows: title.scrollWidth > title.parentElement.parentElement.clientWidth,
            fits: document.documentElement.scrollWidth <= innerWidth,
            taskRight: task.getBoundingClientRect().right,
          };
        });
        assert.ok(geometry.fits && geometry.taskRight <= width);
        assert.ok(geometry.titleOverflows);
        assert.equal(geometry.actionIconSize, 16);
        if (width === 960) {
          assert.equal(geometry.projectHeight, 26);
          assert.equal(geometry.toggleHeight, 26);
          assert.equal(geometry.taskHeight, 26);
          assert.equal(geometry.titleSize, 13);
          assert.ok(geometry.timelineHeight > 26 && geometry.workflowHeight > 26);
        } else {
          assert.ok(geometry.projectHeight >= 44 && geometry.toggleHeight >= 44);
          assert.ok(geometry.taskHeight >= 44);
        }
        await task.focus();
        assert.ok(await task.evaluate((el) => el.matches(":focus-visible")));
        await page.keyboard.press("Enter");
        assert.equal(await page.getByTestId("fixture-action").innerText(), "select:fixture-task");
        await task.hover();
        await page.getByTestId("task-files-fixture-task").click();
        assert.equal(await page.getByTestId("fixture-action").innerText(), "task:files");
        await task.getByRole("button", { name: "取消置顶任务", exact: true }).click();
        assert.equal(
          await page.getByTestId("fixture-action").innerText(),
          "pin:fixture-task:false",
        );
        await page.getByTestId("task-archive-fixture-task").click();
        assert.equal(await page.getByTestId("fixture-action").innerText(), "archive:fixture-task");
        await page.getByTestId("virtual-project-toggle").focus();
        await page.keyboard.press("Enter");
        assert.equal(
          await page.getByTestId("virtual-project-toggle").getAttribute("aria-expanded"),
          "true",
        );
        await page.getByTestId("virtual-project-create-task").click();
        assert.equal(await page.getByTestId("fixture-action").innerText(), "project:create");
        await page.getByTestId("virtual-project-files").click();
        assert.equal(await page.getByTestId("fixture-action").innerText(), "project:files");
        await page.getByTestId("virtual-project-menu").click();
        await page.getByTestId("virtual-project-edit").click();
        await page.getByRole("menu").waitFor({ state: "hidden" });
        assert.equal(await page.getByTestId("fixture-action").innerText(), "project:edit");
        await page.mouse.move(0, 0);
        const waiting = page.getByTestId("task-item-attention-task").locator('[data-slot="badge"]');
        const colors = await waiting.evaluate((el) => {
          const probe = document.createElement("span");
          probe.className =
            "bg-interaction-confirmation-surface text-interaction-confirmation-foreground";
          el.parentElement.appendChild(probe);
          const result = {
            background: getComputedStyle(el).backgroundColor,
            foreground: getComputedStyle(el).color,
            expectedBackground: getComputedStyle(probe).backgroundColor,
            expectedForeground: getComputedStyle(probe).color,
          };
          probe.remove();
          return result;
        });
        assert.equal(colors.background, colors.expectedBackground);
        assert.equal(colors.foreground, colors.expectedForeground);
        await page.screenshot({ path: `${artifacts}/rows-${theme}-${width}.png` });
      } finally {
        await page.close();
      }
    });

for (const width of [960, 390])
  test(`原搜索 cmdk 查询、禁用和菜单返回不改草稿 width=${width}`, async () => {
    const page = await open(
      { surface: "search", locale: "en-US", mobile: width === 390 ? "1" : "0" },
      "ok",
      width,
    );
    try {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Open search", exact: true }).click();
      const input = page.locator("[cmdk-input]");
      await input.waitFor();
      assert.ok(await input.evaluate((el) => el === document.activeElement));
      await input.fill(">preferences");
      const result = page.locator("[cmdk-item]").first();
      await result.waitFor();
      await page.getByRole("dialog").screenshot({
        path: `${artifacts}/search-open-${width}.png`,
        animations: "disabled",
      });
      const geometry = await result.evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
        headingSize: parseFloat(
          getComputedStyle(el.closest("[cmdk-group]").querySelector("[cmdk-group-heading]"))
            .fontSize,
        ),
        iconSize: parseFloat(getComputedStyle(el.querySelector("svg")).width),
        fits: el.closest('[role="dialog"]').getBoundingClientRect().right <= innerWidth,
      }));
      assert.equal(geometry.fontSize, width === 960 ? 13 : 14);
      assert.equal(geometry.headingSize, 12);
      assert.equal(geometry.iconSize, 16);
      assert.ok(geometry.fits);
      if (width === 960) assert.equal(geometry.height, 26);
      else assert.ok(geometry.height >= 44);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await input.waitFor({ state: "hidden" });
      assert.equal(await page.getByTestId("fixture-action").innerText(), "search:settings");
      assert.equal(
        await page.getByRole("textbox", { name: "Unsent draft", exact: true }).inputValue(),
        "unsent draft",
      );
      await page.getByRole("button", { name: "Open search", exact: true }).click();
      await input.waitFor();
      assert.equal(await page.getByRole("button", { name: />\s*preferences/ }).count(), 1);
      await input.fill(">logout");
      assert.equal(await page.locator('[cmdk-item][data-disabled="true"]').count(), 1);
      await page.keyboard.press("Enter");
      assert.ok(await input.isVisible());
      await page.keyboard.press("Escape");
      assert.equal(await page.getByTestId("fixture-action").innerText(), "search:settings");
      assert.equal(
        await page.getByRole("textbox", { name: "Unsent draft", exact: true }).inputValue(),
        "unsent draft",
      );
      await page.screenshot({ path: `${artifacts}/search-${width}.png` });
    } finally {
      await page.close();
    }
  });
for (const theme of ["light", "dark"])
  for (const mobile of ["0", "1"]) {
    test(`展示、复制与主题 ${theme} mobile=${mobile}`, async () => {
      const page = await open({ theme, mobile }, "ok", mobile === "1" ? 390 : 960);
      try {
        const item = page.getByTestId("copy-user-id");
        await item.waitFor();
        assert.equal(
          await page.getByRole("menuitem", { name: "界面缩放", exact: true }).count(),
          mobile === "1" ? 0 : 1,
        );
        assert.equal(
          await page.getByTestId("profile-menu-id").innerText(),
          "ID: 12345678901234567890",
        );
        await page.getByTestId("profile-menu-id").click();
        assert.deepEqual(await page.evaluate(() => window.copiedValues), []);
        await page.mouse.move(0, 0);
        assert.equal(
          await item.evaluate((el) => getComputedStyle(el).backgroundColor),
          "rgba(0, 0, 0, 0)",
        );
        await item.hover();
        await page.waitForFunction(
          () =>
            getComputedStyle(document.querySelector('[data-testid="copy-user-id"]'))
              .backgroundColor !== "rgba(0, 0, 0, 0)",
        );
        await page.mouse.move(0, 0);

        const header = page.getByTestId("profile-menu-header");
        assert.equal(await header.locator('[data-testid="profile-menu-name"]').innerText(), "Alex");
        assert.equal(await header.locator('[data-slot="avatar"]').count(), 1);
        const geometry = await header.evaluate((el) => {
          const name = el
            .querySelector('[data-testid="profile-menu-name"]')
            .getBoundingClientRect();
          const id = el.querySelector('[data-testid="profile-menu-id"]').getBoundingClientRect();
          const copy = el.querySelector('[data-testid="copy-user-id"]').getBoundingClientRect();
          const plan = el
            .querySelector('[data-testid="profile-menu-plan"]')
            .getBoundingClientRect();
          return {
            copyGap: copy.x - id.right,
            planGap: plan.x - name.right,
            nameX: name.x,
            idX: id.x,
            nameBottom: name.bottom,
            idTop: id.top,
            first: el.parentElement.firstElementChild === el,
          };
        });
        assert.equal(geometry.nameX, geometry.idX);
        assert.ok(geometry.idTop >= geometry.nameBottom);
        assert.ok(geometry.first);
        assert.ok(geometry.copyGap >= 0 && geometry.copyGap <= 8);
        assert.ok(geometry.planGap >= 0 && geometry.planGap <= 8);
        assert.equal(await header.getByTestId("profile-menu-plan").innerText(), "Pro");
        await page
          .getByRole("menu")
          .screenshot({ path: `${artifacts}/${theme}-${mobile}.png`, animations: "disabled" });
        await item.click();
        await page.getByText("用户 ID 已复制", { exact: true }).waitFor();
        assert.deepEqual(await page.evaluate(() => window.copiedValues), ["12345678901234567890"]);
      } finally {
        await page.close();
      }
    });
  }
test("长 ID 截断、英文和键盘复制", async () => {
  const id = "user-" + "1234567890".repeat(10);
  const page = await open({ id, locale: "en-US", mobile: "1" }, "ok", 390);
  try {
    const item = page.getByTestId("copy-user-id");
    await item.waitFor();
    const rect = await item.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= 390);
    assert.ok(
      await page.getByTestId("profile-menu-id").evaluate((el) => el.scrollWidth > el.clientWidth),
    );
    await item.focus();
    await page.keyboard.press("Enter");
    await page.getByText("User ID copied", { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.copiedValues), [id]);
  } finally {
    await page.close();
  }
});
for (const params of [{ guest: "1" }, { id: "" }])
  test(`无 ID 隐藏 ${JSON.stringify(params)}`, async () => {
    const page = await open(params);
    try {
      assert.equal(await page.getByTestId("copy-user-id").count(), 0);
    } finally {
      await page.close();
    }
  });
for (const mode of ["reject", "missing"])
  test(`复制失败 ${mode}`, async () => {
    const page = await open({}, mode);
    try {
      await page.getByTestId("copy-user-id").click();
      await page.getByText("复制失败，请重试", { exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(() => window.copiedValues), []);
      assert.equal(await page.getByText("用户 ID 已复制", { exact: true }).count(), 0);
    } finally {
      await page.close();
    }
  });
