// ============================================================
// CLI Prefix Section Builder
// ============================================================

import type { ContextSection } from "../types.js";
import { estimateTokens } from "../utils.js";

// Xbuild 身份句：XBuild 是 Xiatian AI 基于 ZCode 开发的 agent。
const CLI_PREFIX_PROMPT =
  "You are XBuild, an interactive agent developed by Xiatian AI (https://nowint.qzz.io) based on ZCode";

export function buildCliPrefixSection(): ContextSection {
  const content = CLI_PREFIX_PROMPT;

  return {
    name: "CLI Prefix",
    source: "cli_prefix",
    injectionTarget: "system",
    cacheHint: "stable",
    chars: content.length,
    tokens: estimateTokens(content),
    content,
    preview: content.slice(0, 100),
  };
}
