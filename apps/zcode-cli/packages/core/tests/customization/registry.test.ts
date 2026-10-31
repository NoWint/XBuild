import { beforeEach, describe, expect, it } from "vitest";
import { registerCapabilities, resolveEffective, resetCapabilitiesForTest } from "../../src/customization/registry.js";
import type { Capability } from "@zcode/shared";

const cap = (id: string, type: Capability["type"], defaultEnabled = true): Capability => ({
  id,
  type,
  title: id,
  defaultEnabled,
});

describe("resolveEffective", () => {
  beforeEach(() => resetCapabilitiesForTest());

  it("无覆盖时用内置默认", () => {
    const caps = [cap("prompt.identity", "prompt-section"), cap("panel.tasks", "panel", false)];
    const eff = resolveEffective(caps);
    expect(eff.enabled.get("prompt.identity")).toBe(true);
    expect(eff.enabled.get("panel.tasks")).toBe(false);
  });

  it("workspace > user > builtin", () => {
    const caps = [cap("panel.tasks", "panel", true)];
    const user = { version: 1 as const, panels: { disabled: ["panel.tasks"] } };
    const ws = { version: 1 as const, panels: { disabled: [] } };
    expect(resolveEffective(caps, user).enabled.get("panel.tasks")).toBe(false);
    expect(resolveEffective(caps, user, ws).enabled.get("panel.tasks")).toBe(true);
  });

  it("promptAppend 按 user → workspace 顺序拼接", () => {
    const user = {
      version: 1 as const,
      promptAppend: [{ id: "a", title: "A", text: "1" }],
    };
    const ws = {
      version: 1 as const,
      promptAppend: [{ id: "b", title: "B", text: "2" }],
    };
    const eff = resolveEffective([], user, ws);
    expect(eff.promptAppend.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("env 合并且 workspace 覆盖 user", () => {
    const user = { version: 1 as const, env: { A: "1", B: "1" } };
    const ws = { version: 1 as const, env: { B: "2" } };
    const eff = resolveEffective([], user, ws);
    expect(eff.env).toEqual({ A: "1", B: "2" });
  });

  it("promptSections 开关与 replace 透传", () => {
    const user = {
      version: 1 as const,
      promptSections: { identity: { enabled: false }, harness: { replace: "# H" } },
    };
    const eff = resolveEffective([cap("prompt.identity", "prompt-section")], user);
    expect(eff.promptSections.get("identity")?.enabled).toBe(false);
    expect(eff.promptSections.get("harness")?.replace).toBe("# H");
  });

  it("panels.order 未列出的面板按注册顺序排其后", () => {
    const caps = [cap("panel.a", "panel"), cap("panel.b", "panel"), cap("panel.c", "panel")];
    const user = { version: 1 as const, panels: { order: ["panel.c"] } };
    const eff = resolveEffective(caps, user);
    expect(eff.panels.order).toEqual(["panel.c", "panel.a", "panel.b"]);
  });

  it("hooks 数组合并（user 与 workspace 拼接）", () => {
    const user = { version: 1 as const, hooks: { beforeModel: [{ inject: "u" }] } };
    const ws = { version: 1 as const, hooks: { beforeModel: [{ inject: "w" }] } };
    const eff = resolveEffective([], user, ws);
    expect(eff.hooks.beforeModel.map((h) => h.inject)).toEqual(["u", "w"]);
  });
});
