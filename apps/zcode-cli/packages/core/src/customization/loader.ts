// 自定义内核：EffectiveConfig 装配（CLI/desktop 共用，Task 7）。
// 职责有二：集中注册内置能力清单（prompt-section + loop 三节点 + 三面板），
// 以及读两级 overrides 文件后调用 resolveEffective 得出 EffectiveConfig。
// 失败安全约定见 spec §9：文件缺失/非法 → 忽略 + warning，内置默认生效，绝不抛错中断启动。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseOverridesFile, type Capability, type OverridesFileParsed } from "@zcode/shared";
import { builtinPanels } from "./panel-registry.js";
import {
  getRegisteredCapabilities,
  registerCapabilities,
  resolveEffective,
  type EffectiveConfig,
} from "./registry.js";

// -----------------------------------------------
// 内置能力清单
// -----------------------------------------------

/**
 * 内置 prompt-section 的 source 清单：builder.ts 实际 push 的全部 section source
 * （含条件分支 custom_system_prompt / workflow_actor_identity；`tools` 已不再进
 * system prompt，故不在列）。新增内置段时必须同步这里，否则自定义中心看不到、
 * overrides 也无法按 source 寻址。
 */
export const BUILTIN_PROMPT_SECTION_SOURCES: readonly string[] = [
  "cli_prefix",
  "identity",
  "custom_system_prompt",
  "workflow_actor_identity",
  "desktop_context",
  "dynamic_behavior",
  "session_guidance",
  "memory",
  "env_info",
  "model",
  "context_management",
  "session_context",
  "skills",
  "request_user_context",
  "current_date",
];

/** 内置段在自定义中心的显示名（key 与 BUILTIN_PROMPT_SECTION_SOURCES 一一对应）。 */
const BUILTIN_PROMPT_SECTION_TITLES: Readonly<Record<string, string>> = {
  cli_prefix: "产品前缀",
  identity: "Agent 身份",
  custom_system_prompt: "自定义系统提示词",
  workflow_actor_identity: "工作流子代理身份",
  desktop_context: "桌面端交互协议",
  dynamic_behavior: "动态行为边界",
  session_guidance: "会话指导",
  memory: "长期记忆",
  env_info: "环境信息",
  model: "执行模型",
  context_management: "上下文管理",
  session_context: "Git 会话上下文",
  skills: "可用技能",
  request_user_context: "用户上下文",
  current_date: "当前日期",
};

const BUILTIN_LOOP_NODES: readonly { id: string; title: string }[] = [
  { id: "loop.beforeModel", title: "模型请求前钩子" },
  { id: "loop.turnEnd", title: "回合结束钩子" },
  { id: "loop.compact", title: "压缩前钩子" },
];

/**
 * 集中注册内置能力清单。幂等：registerCapabilities 按 id 去重，重复调用不产生
 * 重复条目。loadEffectiveConfig 内部也会调用，装配点无需关心首次调用顺序。
 */
export function registerBuiltinCapabilities(): void {
  const promptSections: Capability[] = BUILTIN_PROMPT_SECTION_SOURCES.map((source) => ({
    id: `prompt.${source}`,
    type: "prompt-section",
    title: BUILTIN_PROMPT_SECTION_TITLES[source] ?? source,
    defaultEnabled: true,
  }));
  const loopNodes: Capability[] = BUILTIN_LOOP_NODES.map((node) => ({
    id: node.id,
    type: "loop-node",
    title: node.title,
    defaultEnabled: true,
  }));
  // 面板清单在 panel-registry.ts（panel.tasks / panel.automations / panel.pluginStore）。
  registerCapabilities([...promptSections, ...loopNodes, ...builtinPanels]);
}

// -----------------------------------------------
// 两级 overrides 文件读取
// -----------------------------------------------

export type OverridesScope = "user" | "workspace";

export interface OverridesReadResult {
  file: OverridesFileParsed;
  /** 文件非法/不可读时的警告（含路径，供自定义中心顶部警告条展示）；正常加载为 undefined。 */
  warning?: string;
}

/**
 * 两级覆盖文件读取器。core 不依赖 @zcode/services（依赖边界），文件读取做成注入参数：
 * 测试注入内存实现；生产默认走下方 createFsOverridesReader（与 services 的
 * customizationService 保持同一文件语义，桌面端 UI 侧仍走 services 的实现）。
 */
export type OverridesReader = (scope: OverridesScope) => OverridesReadResult;

// 全局（user）与工作区（workspace）两级覆盖文件的固定落点（spec §4）。
const USER_OVERRIDES_RELATIVE_PATH = join(".xbuild", "custom", "overrides.json");
const WORKSPACE_OVERRIDES_RELATIVE_PATH = join(".zcode", "custom", "overrides.json");

function emptyOverrides(): OverridesFileParsed {
  return { version: 1 };
}

function readOverridesFileAtPath(filePath: string): OverridesReadResult {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    // 缺失是常态（用户还没写过覆盖），静默回退；其它读取失败给出警告。
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { file: emptyOverrides() };
    }
    return { file: emptyOverrides(), warning: `overrides.json 不可读，已忽略：${filePath}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { file: emptyOverrides(), warning: `overrides.json 不是合法 JSON，已忽略：${filePath}` };
  }
  const result = parseOverridesFile(parsed);
  if (!result.ok) {
    return {
      file: emptyOverrides(),
      warning: `overrides.json 未通过校验（版本未知或字段非法），已忽略：${filePath}`,
    };
  }
  return { file: result.value };
}

/** 默认读取实现：user 读 <home>/.xbuild/custom/overrides.json，workspace 读 <ws>/.zcode/custom/overrides.json。 */
export function createFsOverridesReader(
  homeDir: string,
  workspacePath?: string,
): OverridesReader {
  return (scope) => {
    if (scope === "user") return readOverridesFileAtPath(join(homeDir, USER_OVERRIDES_RELATIVE_PATH));
    if (!workspacePath) return { file: emptyOverrides() };
    return readOverridesFileAtPath(join(workspacePath, WORKSPACE_OVERRIDES_RELATIVE_PATH));
  };
}

// -----------------------------------------------
// EffectiveConfig 装配
// -----------------------------------------------

export interface LoadEffectiveConfigOptions {
  /** 用户主目录（与 ~/.xbuild 隔离体系一致；隔离环境传 ZCODE_DATA_BASE_DIR 同源值）。 */
  homeDir: string;
  /** 会话工作区路径；缺席时只读 user 作用域。 */
  workspacePath?: string;
  /** 注入的两级文件读取器；缺省用内置 fs 实现。 */
  readOverrides?: OverridesReader;
}

export interface LoadedEffectiveConfig {
  eff: EffectiveConfig;
  /** 两级文件全部警告的汇总（非法/不可读/读取异常），调用方只记日志不中断。 */
  warnings: string[];
}

/**
 * 装配 EffectiveConfig：注册内置清单 → 读两级 overrides → resolveEffective 三层合并
 * （builtin ← user ← workspace）。整体失败安全：读取器抛错也按「该级文件缺失」处理并记警告。
 */
export function loadEffectiveConfig(opts: LoadEffectiveConfigOptions): LoadedEffectiveConfig {
  // 首次调用顺序问题：registry 可能尚未注册内置清单，这里先补齐（幂等）。
  registerBuiltinCapabilities();
  const warnings: string[] = [];
  const reader = opts.readOverrides ?? createFsOverridesReader(opts.homeDir, opts.workspacePath);
  let user: OverridesFileParsed | undefined;
  let workspace: OverridesFileParsed | undefined;
  try {
    const userRead = reader("user");
    user = userRead.file;
    if (userRead.warning) warnings.push(userRead.warning);
  } catch (error) {
    warnings.push(
      `user overrides 读取失败，已忽略：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (opts.workspacePath) {
    try {
      const workspaceRead = reader("workspace");
      workspace = workspaceRead.file;
      if (workspaceRead.warning) warnings.push(workspaceRead.warning);
    } catch (error) {
      warnings.push(
        `workspace overrides 读取失败，已忽略：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return {
    eff: resolveEffective(getRegisteredCapabilities(), user, workspace),
    warnings,
  };
}
