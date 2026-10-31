// 自定义内核 loop 钩子三节点（beforeModel / turnEnd / compact）。
// 职责：把 EffectiveConfig.hooks 的声明式规则翻译成本次循环事件可用的注入文本。
// 声明式 inject 在进程内直接解释（零开销）；run 规则经注入的执行函数在独立进程执行
// （runtime 侧桥接 ExecutionPort，与 settings hooks 的 command 型 hook 同一执行形态：
// shell 模式、stdin 传 ctx JSON、timeoutMs 中断）。执行失败/超时/非 JSON 输出一律忽略，
// 不影响主流程（spec §6/§9：钩子失败仅记日志，本轮继续）。
import type { ExecutionPort, Logger } from "@zcode/contracts";
import type { HookRule } from "@zcode/shared";
import { wrapSystemReminderForSource } from "../system-reminder/source.js";
import type { EffectiveConfig } from "./registry.js";

export type LoopHookEvent = "beforeModel" | "turnEnd" | "compact";

/** 事件上下文：原样序列化为 stdin JSON 传给 run 规则（spec §6）。 */
export interface LoopHookContext {
  event: LoopHookEvent;
  workspacePath: string;
  turnIndex: number;
  modelId?: string;
}

/**
 * run 规则执行函数：cmd 在独立进程执行、stdin 收 ctx JSON、成功 resolve stdout 文本；
 * 超时/非零退出/启动失败以 reject 表达。刻意做成注入参数而不是内部单例：
 * 测试 mock 与 runtime 的 ExecutionPort 桥接共用这一契约。
 */
export type LoopHookScriptRunner = (
  cmd: string,
  timeoutMs: number,
  stdinJson: string,
) => Promise<string>;

const DEFAULT_LOOP_HOOK_TIMEOUT_MS = 60_000;
// 与 settings hooks 的 per-request 附加上下文同一量级上限（runtime/methods/hooks.ts）。
const LOOP_HOOK_INJECT_MAX_CHARS = 24_000;
// run 规则 stdout 读取上限，防止脚本误输出大体积日志拖垮请求组装。
const LOOP_HOOK_STDOUT_LIMIT_BYTES = 64 * 1024;

/**
 * 收集一次 loop 钩子事件的注入文本。语义：
 * - inject 规则进程内直接收集（顺序保持）；
 * - run 规则把 ctx 序列化 JSON 传给执行函数 stdin，stdout 必须是合法 JSON 且含
 *   非空字符串字段 `inject` 才采纳；非 JSON/超时/抛错一律忽略。
 */
export async function collectInjects(
  rules: readonly HookRule[] | undefined,
  ctx: LoopHookContext,
  runScript: LoopHookScriptRunner,
): Promise<string[]> {
  const injects: string[] = [];
  for (const rule of rules ?? []) {
    if (typeof rule.inject === "string") {
      // 空白 inject 没有可注入内容，按未采纳处理，避免产出空 system-reminder。
      if (rule.inject.trim().length > 0) injects.push(rule.inject);
      continue;
    }
    if (typeof rule.run !== "string" || rule.run.length === 0) continue;
    try {
      const stdout = await runScript(
        rule.run,
        rule.timeoutMs ?? DEFAULT_LOOP_HOOK_TIMEOUT_MS,
        JSON.stringify(ctx),
      );
      const inject = parseLoopHookStdoutInject(stdout);
      if (inject !== undefined) injects.push(inject);
    } catch {
      // 超时/失败一律忽略该规则（调用方按需记日志），不中断本轮收集。
    }
  }
  return injects;
}

/** stdout 必须是合法 JSON 且含非空字符串 inject 字段才采纳；其余（诊断日志文本）忽略。 */
function parseLoopHookStdoutInject(stdout: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  const inject = (parsed as Record<string, unknown>).inject;
  if (typeof inject !== "string" || inject.trim().length === 0) return undefined;
  return inject;
}

// -----------------------------------------------
// runtime 桥接（turn.ts / compact-active.ts 的发射点共用）
// -----------------------------------------------

/** runtime 发射点所需的最小宿主面；AgentRuntimeInternal 结构性满足它。 */
export interface LoopHookNodeHost {
  contextBuilder?: unknown;
  executionPort?: ExecutionPort;
  workingDirectory: string;
  turnNumber: number;
  logger?: Pick<Logger, "warn" | "info">;
}

/**
 * EffectiveConfig 经 builder config 的 `customization` 字段同源传入（Task 4/7 接线）。
 * 字段尚不存在/缺省时返回 undefined，行为等同无钩子——这里用结构化可选读取，
 * 不改 builder 与其配置类型（避免与并行任务冲突）。
 */
export function readLoopHookEffectiveConfig(
  contextBuilder: unknown,
): EffectiveConfig | undefined {
  if (typeof contextBuilder !== "object" || contextBuilder === null) return undefined;
  const config = (contextBuilder as { config?: unknown }).config;
  if (typeof config !== "object" || config === null) return undefined;
  const customization = (config as { customization?: unknown }).customization;
  if (typeof customization !== "object" || customization === null) return undefined;
  return customization as EffectiveConfig;
}

/**
 * 把 ExecutionPort 桥接成 run 规则执行函数，与 settings hooks 的 command 型 hook
 * 同一执行形态（shell 模式、stdin 传参、超时中断、输出上限）。无端口时返回 undefined。
 */
export function createLoopHookScriptRunner(
  executionPort: ExecutionPort | undefined,
  cwd: string,
): LoopHookScriptRunner | undefined {
  if (!executionPort) return undefined;
  return async (cmd, timeoutMs, stdinJson) => {
    const result = await executionPort.run({
      command: { mode: "shell", command: cmd },
      cwd,
      stdin: stdinJson,
      timeoutMs,
      outputLimit: {
        maxBufferBytes: LOOP_HOOK_STDOUT_LIMIT_BYTES,
        maxInlineBytes: LOOP_HOOK_STDOUT_LIMIT_BYTES,
        persistOutput: "none",
      },
    });
    if (result.status !== "completed" || (result.exitCode ?? 0) !== 0) {
      throw new Error(
        `Loop hook script failed (status=${result.status}, exitCode=${result.exitCode ?? "n/a"})`,
      );
    }
    return result.stdout.text;
  };
}

/**
 * 单个 loop 钩子节点：读 hooks 规则 → collectInjects。任何异常都吞掉并返回空数组；
 * 钩子失败只影响本轮注入，不影响请求/回合（spec §9）。
 */
export async function runLoopHookNode(
  host: LoopHookNodeHost,
  event: LoopHookEvent,
  options: { modelId?: string } = {},
): Promise<string[]> {
  try {
    const rules = readLoopHookEffectiveConfig(host.contextBuilder)?.hooks?.[event] ?? [];
    if (rules.length === 0) return [];
    const runner =
      createLoopHookScriptRunner(host.executionPort, host.workingDirectory) ??
      // 无执行端口时 run 规则不可用：以恒 reject 的执行函数让 collectInjects 逐条忽略。
      ((cmd: string) => Promise.reject(new Error(`execution port unavailable for ${cmd}`)));
    return await collectInjects(
      rules,
      {
        event,
        workspacePath: host.workingDirectory,
        turnIndex: host.turnNumber,
        ...(options.modelId === undefined ? {} : { modelId: options.modelId }),
      },
      runner,
    );
  } catch (error) {
    host.logger?.warn("Loop hook node failed; ignored", {
      event: "customization.loop_hook.node_failed",
      loopHookEvent: event,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * compact 节点的 inject 文本包成 system-reminder 追加到摘要请求提示词
 * （spec §6：「压缩时务必保留…」类指令）。无注入时原样返回。
 */
export function appendLoopHookInjectsToPrompt(
  prompt: string,
  injects: readonly string[],
): string {
  if (injects.length === 0) return prompt;
  const body = injects.map((inject, index) => `#${index + 1}\n${inject}`).join("\n\n");
  const text = truncateLoopHookBody(["Compact hook inject: ", body].join("\n"));
  return `${prompt}\n\n${wrapSystemReminderForSource("hook_context", text)}`;
}

function truncateLoopHookBody(value: string): string {
  return value.length <= LOOP_HOOK_INJECT_MAX_CHARS
    ? value
    : `${value.slice(0, LOOP_HOOK_INJECT_MAX_CHARS)}...`;
}
