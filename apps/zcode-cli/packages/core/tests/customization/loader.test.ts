import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OverridesFileParsed } from "@zcode/shared";
import {
  BUILTIN_PROMPT_SECTION_SOURCES,
  loadEffectiveConfig,
  registerBuiltinCapabilities,
} from "../../src/customization/loader.js";
import {
  getRegisteredCapabilities,
  resetCapabilitiesForTest,
} from "../../src/customization/registry.js";

const tmp = () => mkdtempSync(join(tmpdir(), "xbuild-loader-"));
let dir: string | undefined;
afterEach(() => {
  if (dir) {
    rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

describe("registerBuiltinCapabilities", () => {
  beforeEach(() => resetCapabilitiesForTest());

  it("注册内置 prompt-section / loop 三节点 / 三面板", () => {
    registerBuiltinCapabilities();
    const ids = getRegisteredCapabilities().map((c) => c.id);
    // prompt-section 清单必须逐个覆盖 builder.ts 实际 push 的全部 section source。
    expect(BUILTIN_PROMPT_SECTION_SOURCES).toContain("cli_prefix");
    expect(BUILTIN_PROMPT_SECTION_SOURCES).toContain("identity");
    for (const source of BUILTIN_PROMPT_SECTION_SOURCES) {
      expect(ids, `missing capability prompt.${source}`).toContain(`prompt.${source}`);
    }
    expect(ids).toEqual(
      expect.arrayContaining([
        "loop.beforeModel",
        "loop.turnEnd",
        "loop.compact",
        "panel.tasks",
        "panel.automations",
        "panel.pluginStore",
      ]),
    );
  });

  it("重复注册幂等（不产生重复 id）", () => {
    registerBuiltinCapabilities();
    const first = getRegisteredCapabilities().map((c) => c.id);
    registerBuiltinCapabilities();
    const second = getRegisteredCapabilities().map((c) => c.id);
    expect(second).toEqual(first);
    expect(new Set(second).size).toBe(second.length);
  });
});

describe("loadEffectiveConfig", () => {
  beforeEach(() => resetCapabilitiesForTest());

  it("首次调用顺序问题：registry 未注册时 loader 内部先注册内置清单", () => {
    expect(getRegisteredCapabilities()).toHaveLength(0);
    const { eff } = loadEffectiveConfig({ homeDir: "/home/u" });
    expect(getRegisteredCapabilities().length).toBeGreaterThan(0);
    expect(eff.enabled.get("prompt.identity")).toBe(true);
  });

  it("无覆盖文件时用内置默认（空 env、空 hooks、面板按注册序）", () => {
    const { eff, warnings } = loadEffectiveConfig({ homeDir: "/home/u" });
    expect(warnings).toEqual([]);
    expect(eff.env).toEqual({});
    expect(eff.hooks.beforeModel).toEqual([]);
    expect(eff.panels.order).toEqual(["panel.tasks", "panel.automations", "panel.pluginStore"]);
    expect(eff.panels.disabled).toEqual([]);
  });

  it("两级 overrides 合并：workspace > user；promptAppend 按 user → workspace 拼接", () => {
    const user: OverridesFileParsed = {
      version: 1,
      env: { A: "1", B: "1" },
      promptSections: { identity: { enabled: false } },
      promptAppend: [{ id: "u-rules", title: "U", text: "u" }],
    };
    const workspace: OverridesFileParsed = {
      version: 1,
      env: { B: "2" },
      promptAppend: [{ id: "w-rules", title: "W", text: "w" }],
    };
    const { eff } = loadEffectiveConfig({
      homeDir: "/home/u",
      workspacePath: "/ws",
      readOverrides: (scope) =>
        scope === "user" ? { file: user } : { file: workspace },
    });
    expect(eff.env).toEqual({ A: "1", B: "2" });
    expect(eff.promptSections.get("identity")?.enabled).toBe(false);
    expect(eff.promptAppend.map((p) => p.id)).toEqual(["u-rules", "w-rules"]);
  });

  it("汇总两级文件的 warnings", () => {
    const { warnings } = loadEffectiveConfig({
      homeDir: "/home/u",
      workspacePath: "/ws",
      readOverrides: (scope) =>
        scope === "user"
          ? { file: { version: 1 }, warning: "user bad" }
          : { file: { version: 1 }, warning: "ws bad" },
    });
    expect(warnings).toEqual(["user bad", "ws bad"]);
  });

  it("无 workspacePath 时不读 workspace 作用域", () => {
    const scopes: string[] = [];
    loadEffectiveConfig({
      homeDir: "/home/u",
      readOverrides: (scope) => {
        scopes.push(scope);
        return { file: { version: 1 } };
      },
    });
    expect(scopes).toEqual(["user"]);
  });

  it("readOverrides 抛错 → 失败安全：内置默认生效 + warning，不抛", () => {
    const { eff, warnings } = loadEffectiveConfig({
      homeDir: "/home/u",
      workspacePath: "/ws",
      readOverrides: () => {
        throw new Error("disk broken");
      },
    });
    expect(eff.enabled.get("prompt.identity")).toBe(true);
    expect(eff.env).toEqual({});
    expect(warnings).toHaveLength(2);
  });

  describe("默认读取实现（无注入时按 services 同一文件语义读盘）", () => {
    it("user 作用域读 <home>/.xbuild/custom/overrides.json", () => {
      dir = tmp();
      const p = join(dir, ".xbuild", "custom");
      mkdirSync(p, { recursive: true });
      writeFileSync(
        join(p, "overrides.json"),
        JSON.stringify({ version: 1, env: { FOO: "bar" } }),
      );
      const { eff, warnings } = loadEffectiveConfig({ homeDir: dir });
      expect(eff.env).toEqual({ FOO: "bar" });
      expect(warnings).toEqual([]);
    });

    it("workspace 作用域读 <ws>/.zcode/custom/overrides.json 且 env 覆盖 user", () => {
      dir = tmp();
      const ws = join(dir, "proj");
      mkdirSync(join(dir, ".xbuild", "custom"), { recursive: true });
      mkdirSync(join(ws, ".zcode", "custom"), { recursive: true });
      writeFileSync(
        join(dir, ".xbuild", "custom", "overrides.json"),
        JSON.stringify({ version: 1, env: { A: "1", B: "1" } }),
      );
      writeFileSync(
        join(ws, ".zcode", "custom", "overrides.json"),
        JSON.stringify({ version: 1, env: { B: "2" } }),
      );
      const { eff } = loadEffectiveConfig({ homeDir: dir, workspacePath: ws });
      expect(eff.env).toEqual({ A: "1", B: "2" });
    });

    it("非法 JSON → 空默认 + warning", () => {
      dir = tmp();
      const p = join(dir, ".xbuild", "custom");
      mkdirSync(p, { recursive: true });
      writeFileSync(join(p, "overrides.json"), "{oops");
      const { eff, warnings } = loadEffectiveConfig({ homeDir: dir });
      expect(eff.env).toEqual({});
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/overrides\.json/);
    });

    it("文件缺失 → 空默认，无 warning", () => {
      dir = tmp();
      const { eff, warnings } = loadEffectiveConfig({ homeDir: dir });
      expect(eff.env).toEqual({});
      expect(warnings).toEqual([]);
    });
  });
});
