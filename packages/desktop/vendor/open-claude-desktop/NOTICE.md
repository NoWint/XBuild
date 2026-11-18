# OpenClaude Desktop 0.2.187 UI in XBuild

Source: https://github.com/oleyyu/OpenClaudeDesktop
Version: new-2.42304.0 (ui-next), pinned at `af0b038ab7be4f30d20f98f5e7e82f094a887a9d`.
License: MIT; see `LICENSE`.

The complete shell, its source adapters, and the zero-dependency `zcode-bridge` are retained.
XBuild selects its own bundled `zcode.cjs`, not a separate DeepSeek Harness runtime.
Product identity is XBuild. No Lusion effects or alternate theme system is added.

`dist/assets` contains visual resources shipped by the corresponding public
OpenClaude Desktop 0.2.187 release, excluding the proprietary Anthropic font and
icon-font binaries. XBuild uses system font fallbacks, the MIT Phosphor icon set,
and the included SIL OFL OpenDyslexic / Atkinson Hyperlegible Next fonts.
Claude's spark artwork is replaced with the XBuild mark supplied by the user.
No private user profile is accessed. The vendored shell's upstream extraction and
private-comparison tooling is not an XBuild redistribution grant.
