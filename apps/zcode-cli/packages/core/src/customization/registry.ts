// 自定义内核：能力清单 + 三层合并（builtin ← user ← workspace）。
// 刻意保持无状态、无副作用：不做 DI、不做热重载（见 spec §3）。
import type {
  Capability,
  HookRule,
  LoopParams,
  OverridesFileParsed,
  PromptAppendEntry,
} from "@zcode/shared";

const registered: Capability[] = [];
const seen = new Set<string>();

export function registerCapabilities(caps: readonly Capability[]): void {
  for (const c of caps) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    registered.push(c);
  }
}

export function getRegisteredCapabilities(): readonly Capability[] {
  return registered;
}

export function resetCapabilitiesForTest(): void {
  registered.length = 0;
  seen.clear();
}

export interface EffectiveConfig {
  enabled: ReadonlyMap<string, boolean>;
  promptSections: ReadonlyMap<string, { enabled: boolean; replace?: string }>;
  promptAppend: readonly PromptAppendEntry[];
  env: Readonly<Record<string, string>>;
  loop: LoopParams;
  hooks: { beforeModel: HookRule[]; turnEnd: HookRule[]; compact: HookRule[] };
  panels: { order: string[]; disabled: string[] };
}

function mergePanels(
  caps: readonly Capability[],
  user: OverridesFileParsed | undefined,
  workspace: OverridesFileParsed | undefined,
): { order: string[]; disabled: string[] } {
  const panelIds = caps.filter((c) => c.type === "panel").map((c) => c.id);
  const order = [...(workspace?.panels?.order ?? user?.panels?.order ?? [])];
  for (const id of panelIds) if (!order.includes(id)) order.push(id);
  // workspace 存在时整层接管 panels 配置（与 enabled 的 workspace > user 语义一致）
  const disabled = workspace?.panels?.disabled ?? user?.panels?.disabled ?? [];
  return { order, disabled: [...disabled] };
}

export function resolveEffective(
  caps: readonly Capability[],
  user?: OverridesFileParsed,
  workspace?: OverridesFileParsed,
): EffectiveConfig {
  // 面板禁用清单：workspace 整层接管，缺省回退 user
  const disabledPanels = workspace?.panels?.disabled ?? user?.panels?.disabled ?? [];
  const enabled = new Map<string, boolean>();
  for (const c of caps) {
    // 逐能力 enabled：panel 走 panels.disabled；其余走专用键（当前无，默认 builtin）
    enabled.set(c.id, disabledPanels.includes(c.id) ? false : c.defaultEnabled);
  }
  // prompt 开关：显式 promptSections 键优先于 defaultEnabled
  const promptSections = new Map<string, { enabled: boolean; replace?: string }>();
  for (const c of caps.filter((x) => x.type === "prompt-section")) {
    const key = c.id.replace(/^prompt\./, "");
    const o = user?.promptSections?.[key];
    const w = workspace?.promptSections?.[key];
    const merged = { enabled: w?.enabled ?? o?.enabled ?? c.defaultEnabled, replace: w?.replace ?? o?.replace };
    promptSections.set(key, merged);
    enabled.set(c.id, merged.enabled);
  }
  // 覆盖文件里出现、但未注册为能力的段键：透传进 promptSections（workspace > user）
  const overrideKeys = new Set([
    ...Object.keys(user?.promptSections ?? {}),
    ...Object.keys(workspace?.promptSections ?? {}),
  ]);
  for (const key of overrideKeys) {
    if (promptSections.has(key)) continue;
    const o = user?.promptSections?.[key];
    const w = workspace?.promptSections?.[key];
    promptSections.set(key, {
      enabled: w?.enabled ?? o?.enabled ?? true,
      replace: w?.replace ?? o?.replace,
    });
  }
  const promptAppend = [...(user?.promptAppend ?? []), ...(workspace?.promptAppend ?? [])];
  const env = { ...(user?.env), ...(workspace?.env) };
  const hooks = {
    beforeModel: [...(user?.hooks?.beforeModel ?? []), ...(workspace?.hooks?.beforeModel ?? [])],
    turnEnd: [...(user?.hooks?.turnEnd ?? []), ...(workspace?.hooks?.turnEnd ?? [])],
    compact: [...(user?.hooks?.compact ?? []), ...(workspace?.hooks?.compact ?? [])],
  };
  return {
    enabled,
    promptSections,
    promptAppend,
    env,
    loop: { ...(user?.loop), ...(workspace?.loop) },
    hooks,
    panels: mergePanels(caps, user, workspace),
  };
}
