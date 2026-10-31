// 自定义内核共享类型：overrides 文档结构与能力清单。
export type CapabilityType = "prompt-section" | "loop-node" | "panel" | "feature";

export interface Capability {
  id: string; // "prompt.identity" / "panel.automations" / "loop.beforeModel" / "feature.memory"
  type: CapabilityType;
  title: string;
  description?: string;
  defaultEnabled: boolean;
}

export interface PromptSectionOverride {
  enabled?: boolean;
  replace?: string; // 整段替换文本；与 enabled 并用
}

export interface PromptAppendEntry {
  id: string; // 自定义段 id，不得与内置 section source 冲突
  title: string;
  after?: string; // 锚点：内置 section source；缺省/未找到 → 末尾追加
  text: string;
}

export type HookAction = { inject?: string } & { run?: string; timeoutMs?: number };

export interface HookRule extends HookAction {}

export interface LoopParams {
  maxTurns?: number;
  maxToolCallsPerTurn?: number;
}

export interface PanelsOverride {
  order?: string[]; // 面板 id 全序（未列出的排其后，按注册顺序）
  disabled?: string[];
}

export interface OverridesFile {
  version: 1;
  promptSections?: Record<string, PromptSectionOverride>;
  promptAppend?: PromptAppendEntry[];
  env?: Record<string, string>;
  loop?: LoopParams;
  hooks?: { beforeModel?: HookRule[]; turnEnd?: HookRule[]; compact?: HookRule[] };
  panels?: PanelsOverride;
}
