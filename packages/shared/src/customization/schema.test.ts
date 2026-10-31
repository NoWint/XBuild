import { describe, expect, it } from "vitest";
import { parseOverridesFile } from "./schema.js";

describe("parseOverridesFile", () => {
  it("接受合法最小文档", () => {
    const r = parseOverridesFile({ version: 1 });
    expect(r.ok).toBe(true);
  });

  it("接受完整文档", () => {
    const r = parseOverridesFile({
      version: 1,
      promptSections: { identity: { enabled: true, replace: "hi" } },
      promptAppend: [{ id: "my-rules", title: "My Rules", after: "identity", text: "x" }],
      env: { A: "b" },
      loop: { maxTurns: 64 },
      hooks: { beforeModel: [{ inject: "x" }, { run: "a.sh", timeoutMs: 5000 }] },
      panels: { order: ["tasks"], disabled: ["automations"] },
    });
    expect(r.ok).toBe(true);
  });

  it("拒绝未知 version", () => {
    expect(parseOverridesFile({ version: 2 }).ok).toBe(false);
  });

  it("拒绝未知字段（strict）", () => {
    expect(parseOverridesFile({ version: 1, hacker: true }).ok).toBe(false);
  });

  it("拒绝既无 inject 也无 run 的钩子规则", () => {
    expect(parseOverridesFile({ version: 1, hooks: { beforeModel: [{}] } }).ok).toBe(false);
  });

  it("拒绝非法追加段 id", () => {
    expect(
      parseOverridesFile({ version: 1, promptAppend: [{ id: "Bad Id", title: "t", text: "x" }] }).ok,
    ).toBe(false);
  });
});
