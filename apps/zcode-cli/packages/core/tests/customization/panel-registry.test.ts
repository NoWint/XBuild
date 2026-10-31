import { describe, expect, it } from "vitest";
import { applyPanelOrder, builtinPanels } from "../../src/customization/panel-registry.js";

describe("builtinPanels", () => {
  it("注册三个内置面板且默认全启用", () => {
    expect(builtinPanels.map((p) => p.id)).toEqual([
      "panel.tasks",
      "panel.automations",
      "panel.pluginStore",
    ]);
    expect(builtinPanels.every((p) => p.type === "panel")).toBe(true);
    expect(builtinPanels.every((p) => p.defaultEnabled)).toBe(true);
  });
});

describe("applyPanelOrder", () => {
  // 注册顺序即缺省侧栏顺序：任务列表 / 自动化 / 插件市场。
  const registered = ["panel.tasks", "panel.automations", "panel.pluginStore"];

  it("空配置 → 原注册顺序", () => {
    expect(applyPanelOrder(registered, {})).toEqual(registered);
    expect(applyPanelOrder(registered, { order: [], disabled: [] })).toEqual(registered);
  });

  it("order 重排，未列出者按注册序排尾", () => {
    expect(applyPanelOrder(registered, { order: ["panel.pluginStore"] })).toEqual([
      "panel.pluginStore",
      "panel.tasks",
      "panel.automations",
    ]);
    expect(
      applyPanelOrder(registered, {
        order: ["panel.pluginStore", "panel.automations", "panel.tasks"],
      }),
    ).toEqual(["panel.pluginStore", "panel.automations", "panel.tasks"]);
  });

  it("disabled 剔除面板", () => {
    expect(applyPanelOrder(registered, { disabled: ["panel.automations"] })).toEqual([
      "panel.tasks",
      "panel.pluginStore",
    ]);
  });

  it("order + disabled 组合：先重排再剔除", () => {
    expect(
      applyPanelOrder(registered, {
        order: ["panel.automations", "panel.tasks"],
        disabled: ["panel.tasks"],
      }),
    ).toEqual(["panel.automations", "panel.pluginStore"]);
  });

  it("order 中未注册的 id 忽略、重复 id 去重", () => {
    expect(
      applyPanelOrder(registered, {
        order: ["panel.unknown", "panel.pluginStore", "panel.pluginStore"],
      }),
    ).toEqual(["panel.pluginStore", "panel.tasks", "panel.automations"]);
  });
});
