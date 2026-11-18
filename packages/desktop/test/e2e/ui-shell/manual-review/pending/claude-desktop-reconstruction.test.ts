import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import {
  TID_CHAT_ATTACHMENT_BUTTON,
  TID_CHAT_ATTACHMENT_MENU_ITEM,
  TID_CHAT_MODEL_SELECT_TRIGGER,
  TID_LOGIN_TRIGGER,
  TID_SETTINGS_BACK_BUTTON,
  TID_SETTINGS_SECTION_NAV,
  TID_SIDE_PANE_TOGGLE,
  TID_TASK_SETTINGS_BUTTON,
  TID_TERMINAL_TOGGLE,
  TID_V4_COMPOSER_INPUT,
  TID_WORKSPACE_HEADER,
} from "@zcode/shared/test-ids";
import { setCurrentElectronRendererContentSize } from "#e2e/helpers/desktop-app";
// 真实截图基准：1582px 宽 Claude 空态 composer 实测 671.5px（≈672px），
// 与会话正文的 768px reading rail 不是同一档；所有者见 v4/conversationLayout.ts。
const DRAFT_READING_RAIL_WIDTH = 672;
// 桌面窗口最小宽度由 src/main/desktopWindowSize.ts 的 MIN_DESKTOP_WINDOW_WIDTH 决定。
// e2e tsconfig 只 include 指定的 main 文件，直接 import 会扩大其编译范围；
// 这里用同名常量并保留 owner 注释，改窗口下限时必须同步本断言。
const MIN_DESKTOP_WINDOW_WIDTH = 480;
import {
  getV4ModelConfig,
  prepareV4ConversationE2E,
  setV4ComposerText,
  waitForV4ComposerText,
} from "#e2e/helpers/v4-conversation";

// 真实 Electron/Root/Host UI 验收。Provider 仅使用隔离配置和上游回放，不构造会话行。
// 运行时状态另由既有 provider replay 会话用例验证；本文件不冒充这些证据。
async function setTheme(theme: "zai-light" | "zai-dark") {
  await browser.execute((value) => {
    const actions = (
      window as Window & {
        __testActions?: { setTheme(theme: string): void };
      }
    ).__testActions;
    if (!actions) throw new Error("Missing existing theme action bridge");
    actions.setTheme(value);
  }, theme);
  await browser.waitUntil(() =>
    browser.execute(
      (value) => document.documentElement.classList.contains(`theme-${value}`),
      theme,
    ),
  );
}

async function capture(name: string, theme: string, state: string) {
  const directory = process.env.ZCODE_E2E_ARTIFACT_DIR;
  if (!directory) throw new Error("Missing E2E artifact directory");
  await browser.saveScreenshot(join(directory, `${name}.png`));
  const metadata = await browser.execute(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    deviceScaleFactor: devicePixelRatio,
    rootFontSize: getComputedStyle(document.documentElement).fontSize,
  }));
  await writeFile(
    join(directory, `${name}.json`),
    JSON.stringify(
      {
        product: "XBuild",
        source: "actual-isolated-electron",
        theme,
        state,
        ...metadata,
        officialReferenceAvailable: true,
        pixelParityCertified: false,
      },
      null,
      2,
    ),
  );
}

async function waitForPresentationSettled(selector: string) {
  await browser.waitUntil(
    () =>
      browser.execute((value) => {
        const surface = document.querySelector(value);
        if (!surface) return false;
        return surface
          .getAnimations({ subtree: true })
          .every(
            (animation) =>
              animation.effect?.getComputedTiming().iterations === Infinity ||
              animation.playState === "finished" ||
              animation.playState === "idle",
          );
      }, selector),
    { timeout: 10000, timeoutMsg: `Presentation did not settle: ${selector}` },
  );
}

async function openAndDismissMenu(
  testId: string,
  captureName: string,
  slot: "dropdown-menu-content" | "popover-content" = "dropdown-menu-content",
  // 真实所有权不同：账户菜单回到触发器；模型/effort 菜单故意把焦点送回聊天输入框，
  // 让用户关闭菜单后可以继续输入（ModelConfigSelect.onCloseAutoFocus）。断言必须反映该行为。
  expectedFocusOnClose: { testId: string; reason: string } = {
    testId,
    reason: "default trigger restore",
  },
) {
  const trigger = $(`[data-testid="${testId}"]`);
  await trigger.waitForClickable();
  await browser.execute((value) => {
    document.querySelector<HTMLElement>(`[data-testid="${value}"]`)!.focus();
  }, testId);
  await browser.keys("Enter");
  const surfaceSelector = `[data-slot="${slot}"][data-state="open"]`;
  const menu = $(surfaceSelector);
  await menu.waitForDisplayed();
  await waitForPresentationSettled(surfaceSelector);
  const facts = await browser.execute((selector) => {
    const menu = document.querySelector<HTMLElement>(selector)!;
    const box = menu.getBoundingClientRect();
    return {
      fits: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
      shadow: getComputedStyle(menu).boxShadow,
      items: menu.querySelectorAll('[role^="menuitem"], [role="option"]').length,
    };
  }, surfaceSelector);
  expect(facts.fits).toBe(true);
  expect(facts.shadow).not.toBe("none");
  expect(facts.items).toBeGreaterThan(0);
  await capture(captureName, "dark", "menu");
  await browser.keys("Escape");
  await menu.waitForDisplayed({ reverse: true });
  const focusedTestId = await browser.execute(
    () => document.activeElement?.getAttribute("data-testid") ?? null,
  );
  expect({ focusedTestId, kind: expectedFocusOnClose.reason }).toEqual({
    focusedTestId: expectedFocusOnClose.testId,
    kind: expectedFocusOnClose.reason,
  });
}

describe("Claude Desktop reconstruction — actual XBuild application", () => {
  before(async () => {
    try {
      await prepareV4ConversationE2E();
      await setCurrentElectronRendererContentSize(1200, 800);
    } catch (error) {
      const directory = process.env.ZCODE_E2E_ARTIFACT_DIR!;
      await browser.saveScreenshot(join(directory, "cdr-startup-failure.png"));
      const diagnostics = await browser.execute(() => ({
        url: location.href,
        readyState: document.readyState,
        body: document.body?.innerText ?? "",
        root: document.getElementById("root")?.innerHTML.slice(0, 16000) ?? "",
        testIds: Array.from(document.querySelectorAll("[data-testid]")).map((element) =>
          element.getAttribute("data-testid"),
        ),
        testBridge: typeof (window as Window & { __testActions?: unknown }).__testActions,
        scripts: Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]")).map(
          (script) => script.src,
        ),
      }));
      // 空根节点发生在 React 之前；重读同一模块的已缓存拒绝，保留真实入口异常而不绕过启动。
      const entryModule = await browser.execute(async () => {
        const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
        if (!entry) return { status: "missing-entry" };
        try {
          await import(entry.src);
          return { status: "loaded" };
        } catch (error) {
          return {
            status: "rejected",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          };
        }
      });
      const preload = await browser.electron.execute(async (electron, rendererUrl) => {
        const window = electron.BrowserWindow.getAllWindows().find(
          (candidate) => !candidate.isDestroyed() && candidate.webContents.getURL() === rendererUrl,
        );
        if (!window) throw new Error("Current renderer missing for preload diagnostics");
        const errors: { path: string; message: string; stack?: string }[] = [];
        const record = (_event: unknown, path: string, error: Error) => {
          errors.push({ path, message: error.message, stack: error.stack });
        };
        window.webContents.on("preload-error", record);
        try {
          // 仅在启动已失败时重载隔离窗口采证；不重试准备、不跳过门禁、不改变产品沙箱。
          await new Promise<void>((resolve) => {
            window.webContents.once("did-finish-load", () => resolve());
            window.webContents.reload();
          });
          return { errors };
        } finally {
          window.webContents.removeListener("preload-error", record);
        }
      }, diagnostics.url);
      await writeFile(
        join(directory, "cdr-startup-failure.json"),
        JSON.stringify({ ...diagnostics, entryModule, preload }, null, 2),
      );
      throw error;
    }
  });

  after(async () => {
    await setCurrentElectronRendererContentSize(1200, 800);
  });

  it("CDR-01: measured desktop frame and real new-draft surface in both themes", async () => {
    for (const theme of ["zai-light", "zai-dark"] as const) {
      await setTheme(theme);
      await $(`[data-testid="${TID_V4_COMPOSER_INPUT}"]`).waitForDisplayed();
      await waitForPresentationSettled('[data-v4-composer-dock="true"]');
      const facts = await browser.execute(() => {
        const sidebar = document.querySelector<HTMLElement>(
          '[data-workspace-sidebar-panel="true"]',
        );
        const header = document.querySelector<HTMLElement>('[data-testid="workspace-header"]');
        const greeting = document.querySelector<HTMLElement>("[data-v4-draft-greeting]");
        const greetingGroup = document.querySelector<HTMLElement>("[data-v4-draft-greeting-group]");
        const mark = document.querySelector<HTMLElement>('[data-testid="v4-draft-brand-mark"]');
        const composer = document.querySelector<HTMLElement>(".xb-composer-shell");
        const dock = document.querySelector<HTMLElement>('[data-v4-composer-dock="true"]');
        const readingRail = document.querySelector<HTMLElement>(
          '[data-v4-composer-dock-content="true"]',
        );
        if (!sidebar || !header || !greeting || !greetingGroup || !mark || !composer || !dock || !readingRail)
          throw new Error("Missing real UI surface");
        const readBox = (element: HTMLElement) => {
          const box = element.getBoundingClientRect();
          return {
            width: box.width,
            left: box.left,
            right: box.right,
            centerX: box.left + box.width / 2,
          };
        };
        return {
          sidebar: sidebar.getBoundingClientRect().width,
          header: header.getBoundingClientRect().height,
          dock: readBox(dock),
          readingRail: readBox(readingRail),
          greeting: readBox(greeting),
          greetingGroup: readBox(greetingGroup),
          brand: mark.getAttribute("data-brand"),
          conversationSurface: getComputedStyle(
            document.querySelector<HTMLElement>('[data-workspace-conversation-frame="true"]')!,
          ).backgroundColor,
          sidebarSurface: getComputedStyle(sidebar).backgroundColor,
          composer: {
            ...readBox(composer),
            radius: getComputedStyle(composer).borderRadius,
          },
          greetingFont: getComputedStyle(greeting).fontFamily,
          // CSSOM 会把零字距规范化为 normal；验证实际额外间距，仍拒绝负 tracking。
          greetingLetterSpacing:
            getComputedStyle(greeting).letterSpacing === "normal"
              ? 0
              : Number.parseFloat(getComputedStyle(greeting).letterSpacing),
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          nativeNavigation: !!document.querySelector('[data-testid="sidebar-primary-navigation"]'),
          plugins: !!document.querySelector('[data-testid="plugin-store-sidebar-open"]'),
          automations: !!document.querySelector('[data-testid="automations-open"]'),
        };
      });
      const directory = process.env.ZCODE_E2E_ARTIFACT_DIR!;
      await writeFile(
        join(directory, `desktop-facts-${theme}.json`),
        JSON.stringify(facts, null, 2),
      );
      expect(Math.round(facts.sidebar)).toBe(288);
      expect(Math.round(facts.header)).toBe(36);
      expect(facts.dock.width).toBeGreaterThanOrEqual(DRAFT_READING_RAIL_WIDTH);
      // 宽窗必须铺满实测 672px 草稿轨道，mark + greeting 的组合和 composer 同轴。
      for (const surface of [facts.readingRail, facts.greetingGroup, facts.composer]) {
        expect(surface.width).toBeCloseTo(DRAFT_READING_RAIL_WIDTH, 0);
        expect(surface.centerX).toBeCloseTo(facts.dock.centerX, 0);
      }
      expect(facts.greeting.width).toBeGreaterThan(0);
      expect(facts.brand).toBe("xbuild");
      expect(facts.conversationSurface).not.toBe(facts.sidebarSurface);
      expect(facts.composer.left).toBeGreaterThanOrEqual(0);
      expect(facts.composer.right).toBeLessThanOrEqual(1201);
      expect(facts.composer.radius).toBe("12px");
      expect(facts.greetingFont).toMatch(/Georgia|serif/i);
      expect(facts.greetingLetterSpacing).toBe(0);
      expect(facts.horizontalOverflow).toBe(false);
      expect(facts.nativeNavigation).toBe(true);
      expect(facts.plugins).toBe(true);
      expect(facts.automations).toBe(true);
      await capture(`desktop-draft-${theme}`, theme.endsWith("dark") ? "dark" : "light", "draft");
    }
  });

  it("CDR-03/06: account, model and attachment menus use real owners and restore focus", async () => {
    await setV4ComposerText("CDR_UI_MENU_DRAFT");
    const config = await getV4ModelConfig();
    expect(config.model).toBeTruthy();
    expect(config.provider).toBeTruthy();
    await openAndDismissMenu(TID_LOGIN_TRIGGER, "desktop-account-menu");
    await waitForV4ComposerText("CDR_UI_MENU_DRAFT", "Account menu lost the draft");
    await openAndDismissMenu(TID_CHAT_MODEL_SELECT_TRIGGER, "desktop-model-menu", "dropdown-menu-content", {
      // 关闭模型菜单后焦点回到真实聊天输入框，而不是触发器（见 ModelConfigSelect 注释）。
      testId: TID_V4_COMPOSER_INPUT,
      reason: "model picker restores chat input focus",
    });
    expect(await getV4ModelConfig()).toEqual(config);
    await waitForV4ComposerText("CDR_UI_MENU_DRAFT", "Model menu lost the draft");
    await openAndDismissMenu(
      TID_CHAT_ATTACHMENT_BUTTON,
      "desktop-attachment-menu",
      "popover-content",
    );
    expect(await $(`[data-testid="${TID_CHAT_ATTACHMENT_MENU_ITEM}"]`).isDisplayed()).toBe(false);
    await waitForV4ComposerText("CDR_UI_MENU_DRAFT", "Attachment menu lost the draft");
    await setV4ComposerText("");
  });

  it("CDR-03/06: unsent draft survives actual menus, search and Settings", async () => {
    await setV4ComposerText("CDR_UI_UNSENT_DRAFT");
    const search = $('[data-testid="sidebar-search-open"]');
    await search.click();
    const query = $('[role="dialog"] [cmdk-input]');
    await query.waitForDisplayed();
    await query.setValue("CDR_NO_EXISTING_TASK");
    await capture("desktop-search", "dark", "search");
    await browser.keys("Escape");
    await query.waitForDisplayed({ reverse: true });
    await waitForV4ComposerText("CDR_UI_UNSENT_DRAFT", "Search lost the actual unsent draft");
    await $(`[data-testid="${TID_TASK_SETTINGS_BUTTON}"]`).click();
    await $(".xb-settings-nav").waitForDisplayed();
    const registeredNavigation = await browser.execute(
      (prefix) =>
        Array.from(document.querySelectorAll<HTMLElement>(`[data-testid^="${prefix}-"]`)).map(
          (button) => button.getAttribute("data-testid")!,
        ),
      TID_SETTINGS_SECTION_NAV,
    );
    expect(registeredNavigation.length).toBeGreaterThanOrEqual(12);
    for (const navigationId of registeredNavigation) {
      const navigation = $(`[data-testid="${navigationId}"]`);
      await navigation.scrollIntoView();
      await navigation.click();
      await browser.waitUntil(
        async () => (await navigation.getAttribute("aria-current")) === "page",
      );
      expect(await $('[data-settings-content-frame="true"]').isDisplayed()).toBe(true);
      expect(await browser.execute(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await capture("desktop-settings", "dark", "settings");
    await $(`[data-testid="${TID_SETTINGS_BACK_BUTTON}"]`).click();
    await waitForV4ComposerText(
      "CDR_UI_UNSENT_DRAFT",
      "Settings remounted or lost the draft owner",
    );
    await setV4ComposerText("");
  });

  it("CDR-02/08: actual Side Pane and opened terminal honor shared reduced motion", async () => {
    await setV4ComposerText("CDR_PANE_DRAFT");
    const sidePaneToggle = $(
      `[data-testid="${TID_WORKSPACE_HEADER}"] [data-testid="${TID_SIDE_PANE_TOGGLE}"]`,
    );
    const terminalToggle = $(
      `[data-testid="${TID_WORKSPACE_HEADER}"] [data-testid="${TID_TERMINAL_TOGGLE}"]`,
    );
    const url = await browser.getUrl();
    let sidePaneOpened = false;
    let terminalOpened = false;
    try {
      await sidePaneToggle.waitForClickable();
      await sidePaneToggle.click();
      sidePaneOpened = true;
      await browser.waitUntil(() =>
        browser.execute(
          () =>
            (document.querySelector("[data-workspace-side-frame]")?.getBoundingClientRect().width ??
              0) > 100,
        ),
      );
      await waitForPresentationSettled("#browser");
      const geometry = await browser.execute(() => {
        const conversation = document
          .querySelector('[data-workspace-conversation-frame="true"]')!
          .getBoundingClientRect();
        const side = document.querySelector("[data-workspace-side-frame]")!.getBoundingClientRect();
        const handle = document.querySelector<HTMLElement>(
          '[data-workspace-side-pane-resize-handle="true"]',
        );
        return {
          gap: side.left - conversation.right,
          handleWidth: handle?.getBoundingClientRect().width ?? 0,
          handleRole: handle?.getAttribute("role"),
          handleOrientation: handle?.getAttribute("aria-orientation"),
        };
      });
      await waitForV4ComposerText("CDR_PANE_DRAFT", "Opening Side Pane lost the draft");
      await capture("desktop-side-pane", "dark", "side-pane");
      await browser.electron.execute(async (electron, rendererUrl) => {
        const window = electron.BrowserWindow.getAllWindows().find(
          (candidate) => !candidate.isDestroyed() && candidate.webContents.getURL() === rendererUrl,
        );
        if (!window) throw new Error("Current renderer missing for media emulation");
        if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach("1.3");
        await window.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-reduced-motion", value: "reduce" }],
        });
      }, url);
      await browser.waitUntil(() =>
        browser.execute(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
      );
      await terminalToggle.waitForClickable();
      await terminalToggle.click();
      terminalOpened = true;
      await browser.waitUntil(() =>
        browser.execute(
          () =>
            (document.querySelector("#terminal .xterm")?.getBoundingClientRect().height ?? 0) > 20,
        ),
      );
      await waitForPresentationSettled("#terminal");
      await waitForV4ComposerText("CDR_PANE_DRAFT", "Opening terminal lost the draft");
      // 逐个读取真实外层面板；全局角色数量会把隐藏终端误算成 Side Pane 的覆盖。
      const motion = await browser.execute(() => {
        const readPanel = (frameSelector: string) => {
          const frame = document.querySelector<HTMLElement>(frameSelector);
          // react-resizable-panels 把 className 放在 data-panel 的内层 div 上，
          // 真正持有 opacity transition 的也是内层；探针必须读实际动画元素，
          // 否则会把“类没找到”误报成“reduced-motion 未生效”。
          const panel = frame?.closest<HTMLElement>("[data-panel]")?.firstElementChild;
          if (!frame || !panel) throw new Error(`Missing actual panel: ${frameSelector}`);
          const box = panel.getBoundingClientRect();
          return {
            id: panel.closest<HTMLElement>("[data-panel]")?.id,
            hasSharedMotionRole: panel.classList.contains("xb-animated-pane"),
            width: box.width,
            height: box.height,
            opacity: getComputedStyle(panel).opacity,
            durations: getComputedStyle(panel)
              .transitionDuration.split(",")
              .map((value) => Number.parseFloat(value)),
          };
        };
        return {
          sidePane: readPanel('[data-workspace-side-frame="true"]'),
          terminal: readPanel('[data-workspace-terminal-frame="true"]'),
          headerDurations: Array.from(
            document.querySelectorAll<HTMLElement>(".xb-workspace-header"),
          ).flatMap((element) =>
            getComputedStyle(element)
              .transitionDuration.split(",")
              .map((value) => Number.parseFloat(value)),
          ),
        };
      });
      await writeFile(
        join(process.env.ZCODE_E2E_ARTIFACT_DIR!, "desktop-pane-motion-facts.json"),
        JSON.stringify({ geometry, motion }, null, 2),
      );
      expect(geometry.gap).toBeCloseTo(4, 0);
      expect(geometry.handleWidth).toBe(4);
      expect(geometry.handleRole).toBe("separator");
      expect(geometry.handleOrientation).toBe("vertical");
      expect(await $("[data-side-pane-add-tab-trigger]").isDisplayed()).toBe(true);
      expect(motion.sidePane.id).toBe("browser");
      expect(motion.sidePane.width).toBeGreaterThan(100);
      expect(motion.sidePane.opacity).toBe("1");
      expect(motion.sidePane.hasSharedMotionRole).toBe(true);
      expect(motion.sidePane.durations.length).toBeGreaterThan(0);
      expect(motion.sidePane.durations.every((value) => value <= 0.00001)).toBe(true);
      expect(motion.terminal.id).toBe("terminal");
      expect(motion.terminal.height).toBeGreaterThan(20);
      expect(motion.terminal.opacity).toBe("1");
      expect(motion.terminal.hasSharedMotionRole).toBe(true);
      expect(motion.terminal.durations.length).toBeGreaterThan(0);
      expect(motion.terminal.durations.every((value) => value <= 0.00001)).toBe(true);
      expect(motion.headerDurations.length).toBeGreaterThan(0);
      expect(motion.headerDurations.every((value) => value <= 0.00001)).toBe(true);
    } finally {
      try {
        await browser.electron.execute(async (electron, rendererUrl) => {
          const window = electron.BrowserWindow.getAllWindows().find(
            (candidate) =>
              !candidate.isDestroyed() && candidate.webContents.getURL() === rendererUrl,
          );
          if (window?.webContents.debugger.isAttached()) {
            await window.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", {
              features: [],
            });
          }
        }, url);
      } finally {
        try {
          if (terminalOpened) {
            await terminalToggle.click();
            await browser.waitUntil(() =>
              browser.execute(
                () => !document.querySelector("[data-workspace-terminal-resize-handle]"),
              ),
            );
            await waitForPresentationSettled("#terminal");
          }
        } finally {
          if (sidePaneOpened) {
            await $(`[data-workspace-side-frame] [data-testid="${TID_SIDE_PANE_TOGGLE}"]`).click();
            await browser.waitUntil(() =>
              browser.execute(
                () => !document.querySelector("[data-workspace-side-pane-resize-handle]"),
              ),
            );
            await waitForPresentationSettled("#browser");
          }
        }
      }
    }
    await waitForV4ComposerText("CDR_PANE_DRAFT", "Closing Side Pane lost the draft");
    await setV4ComposerText("");
  });

  it("CDR-02: actual narrow window retains editable composer without overflow", async () => {
    // 桌面窗口最小宽度是 MIN_DESKTOP_WINDOW_WIDTH=480（desktopWindowSize.ts），
    // 所以桌面壳真正可达的最窄宽度是 480，不能把 390 当桌面尺寸断言。
    // 390 属于手机/窄 Web 场景，由 shared-component browser 套件
    // （claude-desktop-design-system.test.mjs 的 390 宽度用例）覆盖，不在此重复冒充。
    try {
      await setV4ComposerText("CDR_RESIZE_DRAFT");
      for (const width of [1440, 768, MIN_DESKTOP_WINDOW_WIDTH]) {
        await setCurrentElectronRendererContentSize(width, 800);
        await browser.waitUntil(() =>
          browser.execute((expected: number) => window.innerWidth === expected, width),
        );
        await $(`[data-testid="${TID_V4_COMPOSER_INPUT}"]`).waitForDisplayed();
        await waitForV4ComposerText("CDR_RESIZE_DRAFT", "Resize lost the draft");
        const bounds = await browser.execute((id) => {
          const input = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
          const box = input.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            width: innerWidth,
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          };
        }, TID_V4_COMPOSER_INPUT);
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
        expect(bounds.horizontalOverflow).toBe(false);
        await capture(`desktop-narrow-${width}`, "dark", "draft-resize");
      }
    } finally {
      await setCurrentElectronRendererContentSize(1200, 800);
    }
  });
});
