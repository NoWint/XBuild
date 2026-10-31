// 提示词覆盖：在 builder 组装完成后过滤/替换/追加。纯函数，不改入参（spec §5）。
// 失败安全由调用方保证：overrides 文件非法时 loader 回退空配置，不进到这里（spec §9）。
import type { ContextSection } from "../context/types.js";
import type { EffectiveConfig } from "./registry.js";
import { estimateTokens } from "../context/utils.js";

export function applyPromptOverrides(
  sections: readonly ContextSection[],
  eff: EffectiveConfig,
): ContextSection[] {
  // 1. 过滤 enabled === false 的段（未配置的段保持内置行为）
  let out = sections.filter((s) => eff.promptSections.get(s.source)?.enabled ?? true);
  // 2. 应用 replace：整段替换文本，chars/tokens/preview 同步重算
  out = out.map((s) => {
    const replace = eff.promptSections.get(s.source)?.replace;
    if (replace === undefined) return s;
    return {
      ...s,
      content: replace,
      chars: replace.length,
      tokens: estimateTokens(replace),
      preview: replace.slice(0, 100),
    };
  });
  // 3. 追加段：id 与现存 section source 冲突 → 丢弃该追加段（spec §9，警告由 loader/设置页负责）
  const appends = eff.promptAppend.filter((a) => !out.some((s) => s.source === a.id));
  if (appends.length === 0) return [...out];
  const withAppends = [...out];
  // 逆序插入：多个追加段锚在同一段时保持 promptAppend 的拼接顺序（user → workspace）
  for (const a of [...appends].reverse()) {
    const section: ContextSection = {
      name: a.title,
      // 追加段 id 是用户自定义字符串，而 ContextSource 是封闭字面量联合；此处借位承载，仅用于排序/寻址
      source: a.id as ContextSection["source"],
      injectionTarget: "system",
      cacheHint: "stable",
      chars: a.text.length,
      tokens: estimateTokens(a.text),
      content: a.text,
      preview: a.text.slice(0, 100),
    };
    // 锚点不存在（被禁用或 id 未找到）→ 退化为追加到末尾
    const anchorIdx = a.after ? withAppends.findIndex((s) => s.source === a.after) : -1;
    if (anchorIdx >= 0) withAppends.splice(anchorIdx + 1, 0, section);
    else withAppends.push(section);
  }
  return withAppends;
}
