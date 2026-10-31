// 自定义内核：内置面板能力清单 + 面板排序纯函数（spec §7 面板注册制）。
// 注册表本体在 ./registry.ts；本文件只提供内置面板清单与 order/disabled 语义的权威实现，
// 保持无副作用：真正的 registerCapabilities 由 Task 7 的 loader 在装配点调用。
import type { Capability } from "@zcode/shared";

/** 内置三面板：任务列表 / 自动化 / 插件市场；数组顺序即缺省侧栏顺序。 */
export const builtinPanels: Capability[] = [
  { id: "panel.tasks", type: "panel", title: "任务列表", defaultEnabled: true },
  { id: "panel.automations", type: "panel", title: "自动化", defaultEnabled: true },
  { id: "panel.pluginStore", type: "panel", title: "插件市场", defaultEnabled: true },
];

/**
 * 按 overrides 的 panels 配置重排注册面板：order 先行（未注册的 id 忽略、重复去重），
 * 未列出的按注册序排尾；disabled 整体剔除。纯函数，不改入参。
 */
export function applyPanelOrder(
  registeredIds: readonly string[],
  panels: { order?: string[]; disabled?: string[] },
): string[] {
  const registered = new Set(registeredIds);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of panels.order ?? []) {
    if (seen.has(id) || !registered.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  for (const id of registeredIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  const disabled = new Set(panels.disabled ?? []);
  return ordered.filter((id) => !disabled.has(id));
}
