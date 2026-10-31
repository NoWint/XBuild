import { describe, expect, it, vi } from "vitest";
import { collectInjects } from "../../src/customization/loop-hook-nodes.js";
import type { HookRule } from "@zcode/shared";

const baseCtx = {
  event: "beforeModel" as const,
  workspacePath: "/tmp/ws",
  turnIndex: 3,
  modelId: "zai/glm-5.3",
};

describe("collectInjects", () => {
  it("纯 inject 规则按序返回文本", async () => {
    const rules: HookRule[] = [{ inject: "第一条" }, { inject: "第二条" }];
    const runScript = vi.fn();
    expect(await collectInjects(rules, baseCtx, runScript)).toEqual(["第一条", "第二条"]);
    expect(runScript).not.toHaveBeenCalled();
  });

  it("run 规则 stdout 合法 JSON 且含字符串 inject 字段 → 采纳，ctx 以 stdin JSON 透传", async () => {
    const seen: { cmd: string; timeoutMs: number; stdin: unknown }[] = [];
    const runScript = vi.fn(async (cmd: string, timeoutMs: number, stdinJson: string) => {
      seen.push({ cmd, timeoutMs, stdin: JSON.parse(stdinJson) });
      return JSON.stringify({ inject: "压缩时务必保留 goal 状态" });
    });
    const rules: HookRule[] = [{ run: "node inject.js", timeoutMs: 5000 }];
    expect(await collectInjects(rules, baseCtx, runScript)).toEqual([
      "压缩时务必保留 goal 状态",
    ]);
    expect(seen).toEqual([
      {
        cmd: "node inject.js",
        timeoutMs: 5000,
        stdin: {
          event: "beforeModel",
          workspacePath: "/tmp/ws",
          turnIndex: 3,
          modelId: "zai/glm-5.3",
        },
      },
    ]);
  });

  it("run 规则未配置 timeoutMs 时向执行函数传默认超时", async () => {
    const runScript = vi.fn(async () => JSON.stringify({ inject: "x" }));
    await collectInjects([{ run: "echo hi" }], baseCtx, runScript);
    expect(runScript).toHaveBeenCalledWith("echo hi", 60_000, expect.any(String));
  });

  it("run 规则 stdout 非 JSON → 忽略", async () => {
    const runScript = vi.fn(async () => "hook 脚本的一条普通日志输出");
    expect(await collectInjects([{ run: "logger.sh" }], baseCtx, runScript)).toEqual([]);
  });

  it("run 规则 stdout JSON 但缺 inject 字段或 inject 非字符串 → 忽略", async () => {
    const runScript = vi.fn(async (cmd: string) =>
      cmd === "a" ? JSON.stringify({ other: 1 }) : JSON.stringify({ inject: 42 }),
    );
    expect(
      await collectInjects([{ run: "a" }, { run: "b" }], baseCtx, runScript),
    ).toEqual([]);
  });

  it("run 规则 stdout inject 为空字符串 → 忽略", async () => {
    const runScript = vi.fn(async () => JSON.stringify({ inject: "  " }));
    expect(await collectInjects([{ run: "empty.sh" }], baseCtx, runScript)).toEqual([]);
  });

  it("run 规则抛错/超时（reject）→ 忽略且不向外抛", async () => {
    const runScript = vi.fn(async (cmd: string) => {
      if (cmd === "boom") throw new Error("script failed");
      if (cmd === "slow") throw new Error("timed out after 1000ms");
      return JSON.stringify({ inject: "ok" });
    });
    expect(
      await collectInjects(
        [{ run: "boom" }, { run: "slow" }, { run: "good.sh" }],
        baseCtx,
        runScript,
      ),
    ).toEqual(["ok"]);
  });

  it("inject 与 run 混合时保持规则顺序", async () => {
    const runScript = vi.fn(async (cmd: string) => {
      if (cmd === "broken.sh") throw new Error("failed");
      return JSON.stringify({ inject: "来自脚本" });
    });
    const rules: HookRule[] = [
      { inject: "声明式一" },
      { run: "script.sh" },
      { inject: "声明式二" },
      { run: "broken.sh" },
      { inject: "声明式三" },
    ];
    expect(await collectInjects(rules, baseCtx, runScript)).toEqual([
      "声明式一",
      "来自脚本",
      "声明式二",
      "声明式三",
    ]);
  });

  it("空规则数组 → 空数组", async () => {
    expect(await collectInjects([], baseCtx, vi.fn())).toEqual([]);
  });
});
