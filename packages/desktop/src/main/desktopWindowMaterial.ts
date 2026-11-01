// Windows 桌面窗口背景材质。
//
// Electron 内置的 backgroundMaterial 只支持 Windows 11 22H2+（DWM backdrop），
// 且没有 blur-behind 档位；这里直接调用 user32!SetWindowCompositionAttribute，
// 用 accent policy 在 Windows 10/11 上实现两种材质：
//   - acrylic（默认）：ACCENT_ENABLE_ACRYLICBLURBEHIND 亚克力
//   - blur：ACCENT_ENABLE_BLURBEHIND 模糊
//
// 应用前提：窗口必须是逐像素透明的（transparent: true + backgroundColor #00000000），
// renderer 根面用半透明色，DWM 才能在页面透明区域绘制模糊材质。
// macOS 使用原生 vibrancy，不经过本模块；Web/Linux 忽略该设置。
import { BrowserWindow, nativeTheme } from "electron";
import type { DesktopWindowMaterial } from "@zcode/shared";

// user32!SetWindowCompositionAttribute 的输入结构（未公开但长期稳定）。
const WCA_ACCENT_POLICY = 19;
const ACCENT_ENABLE_BLURBEHIND = 3;
const ACCENT_ENABLE_ACRYLICBLURBEHIND = 4;
// acrylic 需要 AccentFlags=2 才会叠加渐变 tint；blur-behind 保持 0。
const ACCENT_FLAGS_ACRYLIC = 2;
const ACCENT_FLAGS_BLUR = 0;
// GradientColor 是 0xAABBGGRR。60% 黑/白的 tint 叠加页面自身半透明层后，
// 观感接近 macOS vibrancy 的压暗程度；浅色主题用白色 tint。
const ACRYLIC_TINT_DARK = 0x99000000;
const ACRYLIC_TINT_LIGHT = 0x99ffffff;

interface WindowsAccentBridge {
  apply(hwnd: number, accentState: number, accentFlags: number, gradientColor: number): boolean;
}

/** 未知/缺失值一律按默认 acrylic 处理，兼容旧 settings 文件。 */
export function normalizeDesktopWindowMaterial(value: unknown): DesktopWindowMaterial {
  return value === "blur" ? "blur" : "acrylic";
}

function resolveAcrylicGradientColor(): number {
  return nativeTheme.shouldUseDarkColors ? ACRYLIC_TINT_DARK : ACRYLIC_TINT_LIGHT;
}

let bridgePromise: Promise<WindowsAccentBridge | null> | undefined;
let bridge: WindowsAccentBridge | null | undefined;
let fallbackLogged = false;
let themeListenerInstalled = false;
let currentMaterial: DesktopWindowMaterial = "acrylic";
// 已应用材质的窗口；hide→show / 主题切换后需要重放 accent policy。
const materialWindows = new Set<BrowserWindow>();

/**
 * 在创建首个窗口前预热 koffi 桥接，让窗口创建时就能同步应用材质，
 * 避免先露出未模糊的透明窗口再补材质。
 */
export function prepareDesktopWindowMaterialBridge(): Promise<WindowsAccentBridge | null> {
  if (process.platform !== "win32") {
    return Promise.resolve(null);
  }
  bridgePromise ??= createWindowsAccentBridge();
  return bridgePromise.then((loaded) => {
    bridge = loaded;
    return loaded;
  });
}

async function createWindowsAccentBridge(): Promise<WindowsAccentBridge | null> {
  try {
    const koffiModule = await import("koffi");
    const koffi = ("default" in koffiModule ? koffiModule.default : koffiModule) as typeof import("koffi");
    const user32 = koffi.load("user32.dll");
    const accentPolicy = koffi.struct("ACCENT_POLICY", {
      AccentState: "int32",
      AccentFlags: "int32",
      GradientColor: "uint32",
      AnimationId: "int32",
    });
    const compositionData = koffi.struct("WINDOWCOMPOSITIONATTRIBDATA", {
      Attrib: "uint32",
      pvData: "void *",
      cbData: "size_t",
    });
    const setWindowCompositionAttribute = user32.func(
      "__stdcall",
      "SetWindowCompositionAttribute",
      "int",
      ["uintptr_t", koffi.pointer(compositionData)],
    );
    const policyBuffer = koffi.alloc(accentPolicy, 1);
    const dataBuffer = koffi.alloc(compositionData, 1);
    const policySize = koffi.sizeof(accentPolicy);

    return {
      apply(hwnd, accentState, accentFlags, gradientColor) {
        koffi.encode(policyBuffer, accentPolicy, {
          AccentState: accentState,
          AccentFlags: accentFlags,
          GradientColor: gradientColor,
          AnimationId: 0,
        });
        koffi.encode(dataBuffer, compositionData, {
          Attrib: WCA_ACCENT_POLICY,
          pvData: policyBuffer,
          cbData: policySize,
        });
        return setWindowCompositionAttribute(hwnd, dataBuffer) === 1;
      },
    };
  } catch (error) {
    console.warn("[desktop-window-material] koffi accent bridge unavailable", error);
    return null;
  }
}

function resolveWindowHandle(win: BrowserWindow): number | null {
  try {
    const handle = win.getNativeWindowHandle();
    if (!handle || handle.length === 0) return null;
    // Windows 只有 x64/arm64；ia32 分支仅是防御性兜底。
    return handle.length >= 8 ? Number(handle.readBigUInt64LE(0)) : handle.readUInt32LE(0);
  } catch {
    return null;
  }
}

/** koffi/SetWindowCompositionAttribute 不可用时的兜底：退回 Electron 原生 backdrop（Win11 22H2+）。 */
function applyElectronBackgroundMaterialFallback(win: BrowserWindow): void {
  try {
    win.setBackgroundMaterial("acrylic");
  } catch (error) {
    if (!fallbackLogged) {
      fallbackLogged = true;
      console.warn("[desktop-window-material] native background material fallback failed", error);
    }
  }
}

function applyAccentPolicy(win: BrowserWindow, material: DesktopWindowMaterial): void {
  const hwnd = resolveWindowHandle(win);
  if (hwnd === null) return;
  const accentState =
    material === "blur" ? ACCENT_ENABLE_BLURBEHIND : ACCENT_ENABLE_ACRYLICBLURBEHIND;
  const accentFlags = material === "blur" ? ACCENT_FLAGS_BLUR : ACCENT_FLAGS_ACRYLIC;
  const gradientColor = material === "blur" ? 0 : resolveAcrylicGradientColor();
  if (bridge && !bridge.apply(hwnd, accentState, accentFlags, gradientColor)) {
    console.warn(`[desktop-window-material] SetWindowCompositionAttribute failed (${material})`);
  }
}

function ensureThemeListener(): void {
  if (themeListenerInstalled) return;
  themeListenerInstalled = true;
  // 主题切换只影响 acrylic 的 tint 颜色；重放同名材质即可，不影响窗口内容。
  nativeTheme.on("updated", () => {
    if (process.platform !== "win32") return;
    for (const win of materialWindows) {
      if (win.isDestroyed()) {
        materialWindows.delete(win);
        continue;
      }
      applyAccentPolicy(win, currentMaterial);
    }
  });
}

/**
 * 给窗口应用背景材质。窗口创建后立即调用（bridge 已由启动流程预热时是同步的），
 * 后续设置切换/主题切换也经此重放。
 */
export function applyDesktopWindowMaterial(win: BrowserWindow, material: DesktopWindowMaterial): void {
  if (process.platform !== "win32" || win.isDestroyed()) {
    return;
  }
  materialWindows.add(win);
  ensureThemeListener();
  win.once("closed", () => materialWindows.delete(win));

  if (bridge === undefined) {
    // 预热尚未完成（例如测试环境直接建窗）：异步补一次，期间先不改变窗口外观。
    void prepareDesktopWindowMaterialBridge().then((loaded) => {
      if (win.isDestroyed()) return;
      if (loaded) applyAccentPolicy(win, material);
      else applyElectronBackgroundMaterialFallback(win);
    });
    return;
  }
  if (!bridge) {
    applyElectronBackgroundMaterialFallback(win);
    return;
  }
  applyAccentPolicy(win, material);
}

/** 设置变更即时生效：更新当前材质并重放到所有已创建的应用窗口。 */
export function syncDesktopWindowMaterial(value: unknown): DesktopWindowMaterial {
  currentMaterial = normalizeDesktopWindowMaterial(value);
  if (process.platform !== "win32") {
    return currentMaterial;
  }
  for (const win of materialWindows) {
    if (win.isDestroyed()) {
      materialWindows.delete(win);
      continue;
    }
    applyAccentPolicy(win, currentMaterial);
  }
  return currentMaterial;
}
