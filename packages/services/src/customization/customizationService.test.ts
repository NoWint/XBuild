// 自定义内核 overrides 读写服务的单测：全部走临时目录，不触碰真实 HOME。
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultOverrides,
  loadUserOverrides,
  loadWorkspaceOverrides,
  saveOverrides,
} from "./customizationService.js";

const tmp = () => mkdtempSync(join(tmpdir(), "xbuild-cust-"));
let dir = "";
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("customizationService", () => {
  it("缺失文件 → 空默认，无 warning", () => {
    dir = tmp();
    const r = loadUserOverrides(dir);
    expect(r.file).toEqual({ version: 1 });
    expect(r.warning).toBeUndefined();
  });

  it("非法 JSON → 空默认 + warning", () => {
    dir = tmp();
    const p = join(dir, ".xbuild", "custom");
    mkdirSync(p, { recursive: true });
    writeFileSync(join(p, "overrides.json"), "{oops");
    const r = loadUserOverrides(dir);
    expect(r.file).toEqual({ version: 1 });
    expect(r.warning).toMatch(/overrides\.json/);
  });

  it("schema 非法 → 空默认 + warning", () => {
    dir = tmp();
    const p = join(dir, ".xbuild", "custom");
    mkdirSync(p, { recursive: true });
    writeFileSync(join(p, "overrides.json"), JSON.stringify({ version: 9 }));
    expect(loadUserOverrides(dir).warning).toBeDefined();
  });

  it("save → load 往返（user 作用域）", async () => {
    dir = tmp();
    const file = { version: 1 as const, env: { A: "1" } };
    await saveOverrides("user", { homeDir: dir }, file);
    expect(loadUserOverrides(dir).file).toEqual(file);
  });

  it("save workspace 作用域落到 <ws>/.zcode/custom/", async () => {
    dir = tmp();
    const ws = join(dir, "proj");
    const file = { version: 1 as const, panels: { disabled: ["panel.pluginStore"] } };
    await saveOverrides("workspace", { homeDir: dir, workspacePath: ws }, file);
    expect(loadWorkspaceOverrides(ws).file).toEqual(file);
  });

  it("defaultOverrides 为空文档", () => {
    expect(defaultOverrides()).toEqual({ version: 1 });
  });
});
