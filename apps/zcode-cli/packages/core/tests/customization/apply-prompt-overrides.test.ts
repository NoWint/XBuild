import { describe, expect, it } from "vitest";
import { applyPromptOverrides } from "../../src/customization/apply-prompt-overrides.js";
import type { EffectiveConfig } from "../../src/customization/registry.js";
import { estimateTokens } from "../../src/context/utils.js";
import type { ContextSection, ContextSource } from "../../src/context/types.js";

// 构造空的生效配置：无任何覆盖（与 resolveEffective 无覆盖时的形状一致）。
const emptyEff = (): EffectiveConfig => ({
  enabled: new Map(),
  promptSections: new Map(),
  promptAppend: [],
  env: {},
  loop: {},
  hooks: { beforeModel: [], turnEnd: [], compact: [] },
  panels: { order: [], disabled: [] },
});

// 构造最小 ContextSection（默认 system + stable，与 builder 内置 stable 段一致）。
const makeSection = (
  source: ContextSource,
  content: string,
  patch: Partial<ContextSection> = {},
): ContextSection => ({
  name: source,
  source,
  injectionTarget: "system",
  cacheHint: "stable",
  chars: content.length,
  tokens: estimateTokens(content),
  content,
  preview: content.slice(0, 100),
  ...patch,
});

describe("applyPromptOverrides", () => {
  it("enabled=false 的段被过滤", () => {
    const eff: EffectiveConfig = {
      ...emptyEff(),
      promptSections: new Map([["identity", { enabled: false }]]),
    };
    const sections = [makeSection("cli_prefix", "PREFIX"), makeSection("identity", "I am XBuild.")];
    const out = applyPromptOverrides(sections, eff);
    expect(out.map((s) => s.source)).toEqual(["cli_prefix"]);
  });

  it("replace 整段替换 content 且 chars/tokens 重算", () => {
    const replaced = "# 身份（已替换）";
    const eff: EffectiveConfig = {
      ...emptyEff(),
      promptSections: new Map([["identity", { enabled: true, replace: replaced }]]),
    };
    const original = makeSection("identity", "I am XBuild.");
    const out = applyPromptOverrides([original], eff);
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe(replaced);
    expect(out[0].chars).toBe(replaced.length);
    expect(out[0].tokens).toBe(estimateTokens(replaced));
    expect(out[0].preview).toBe(replaced.slice(0, 100));
    // 纯函数：不得改写入参 section
    expect(original.content).toBe("I am XBuild.");
    expect(original.chars).toBe("I am XBuild.".length);
  });

  it("promptAppend 按 after 锚点紧随插入", () => {
    const text = "custom rules body";
    const eff: EffectiveConfig = {
      ...emptyEff(),
      promptAppend: [{ id: "my-rules", title: "My Rules", after: "identity", text }],
    };
    const sections = [makeSection("cli_prefix", "P"), makeSection("identity", "I"), makeSection("tools", "T")];
    const out = applyPromptOverrides(sections, eff);
    expect(out.map((s) => s.source)).toEqual(["cli_prefix", "identity", "my-rules", "tools"]);
    const appended = out[2];
    expect(appended.name).toBe("My Rules");
    expect(appended.injectionTarget).toBe("system");
    expect(appended.cacheHint).toBe("stable");
    expect(appended.chars).toBe(text.length);
    expect(appended.tokens).toBe(estimateTokens(text));
    expect(appended.preview).toBe(text.slice(0, 100));
  });

  it("锚点不存在时退化为追加到末尾", () => {
    const eff: EffectiveConfig = {
      ...emptyEff(),
      promptAppend: [{ id: "my-rules", title: "My Rules", after: "no_such_anchor", text: "x" }],
    };
    const sections = [makeSection("identity", "I"), makeSection("tools", "T")];
    const out = applyPromptOverrides(sections, eff);
    expect(out.map((s) => s.source)).toEqual(["identity", "tools", "my-rules"]);
  });

  it("锚点段被禁用时同样退化为末尾追加", () => {
    const eff: EffectiveConfig = {
      ...emptyEff(),
      promptSections: new Map([["identity", { enabled: false }]]),
      promptAppend: [{ id: "my-rules", title: "My Rules", after: "identity", text: "x" }],
    };
    const sections = [makeSection("identity", "I"), makeSection("tools", "T")];
    const out = applyPromptOverrides(sections, eff);
    expect(out.map((s) => s.source)).toEqual(["tools", "my-rules"]);
  });

  it("追加段 id 与内置 source 冲突时该段被丢弃", () => {
    const eff: EffectiveConfig = {
      ...emptyEff(),
      promptAppend: [{ id: "identity", title: "Hijack", text: "evil" }],
    };
    const sections = [makeSection("identity", "I")];
    const out = applyPromptOverrides(sections, eff);
    expect(out.map((s) => s.source)).toEqual(["identity"]);
    expect(out[0].content).toBe("I");
  });

  it("无任何覆盖时返回与输入等价的数组（浅拷贝）", () => {
    const sections = [makeSection("identity", "I"), makeSection("tools", "T")];
    const out = applyPromptOverrides(sections, emptyEff());
    expect(out).not.toBe(sections);
    expect(out).toEqual(sections);
    // 浅拷贝：元素引用保持不变
    expect(out[0]).toBe(sections[0]);
    expect(out[1]).toBe(sections[1]);
  });
});
