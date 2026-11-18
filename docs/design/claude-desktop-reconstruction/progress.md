# XBuild desktop reconstruction ledger

## 2026-11-19 — selected OpenClaudeDesktop shell

The default desktop main entry now starts the complete MIT `new-2.42304.0`
shell through `src/open-shell/index.ts`. `ZCODE_LEGACY_DESKTOP_UI=1` retains the
old renderer for compatibility acceptance. The Web and mobile remote-control
renderer is unchanged.

The live execution chain is:

```text
XBuild Electron entry → vendored Electron main → zcode-bridge
  → bundled zcode.cjs app-server --stdio → zcode-cli
```

This is not yet the old window Host owning the new shell's session execution.
The bridge directly starts the bundled Agent; do not describe the Host
integration as complete until the corresponding runtime flows have evidence.

### Verified before the first public-source baseline

- Shell production Vite build completed after replacing proprietary font assets.
- A real isolated Electron window at 1200 × 800 rendered as `XBuild`.
- Projects, Artifacts, Routines and Customize were opened through Electron CDP.
- Shared generated icon factories were redirected to the vendored MIT Phosphor
  library: 23 SVG icons and zero private-glyph spans on the new-session surface;
  zero private-glyph spans on each inspected navigation surface.
- No horizontal document overflow or failed resource requests were observed on
  the initial window. The Projects page exposed a stale `Claude` string, which
  has been corrected to XBuild and needs the next browser refresh for evidence.
- `node --import tsx --test packages/desktop/vendor/open-claude-desktop/app/tests/xbuild-icons.test.mjs`:
  two assertions passed after correcting the test's default size expectation.
- `pnpm typecheck`: passed using Node 24.15.0.
- `pnpm lint`: 102 warnings, zero errors.
- Earlier bridge initialization identified the real bundled Agent as `zcode
  0.17.1`; the packaged terminal rendered real shell output.

### Explicitly not verified

- No configured provider was available in the isolated acceptance profile, so
  no real prompt, streaming response, permission approval, file edit or retry
  has been accepted in this shell.
- Old-Host session ownership, mobile attachment, scheduled/off-peak execution,
  DSH plugin behavior and full remote compatibility remain unverified here.
- The old legacy acceptance background task no longer exists in the harness;
  no passing result is inferred from it.
- The optional macOS x86_64 window-bounds Swift helper failed to link because
  the installed SDK lacks the x86_64 compatibility libraries. This does not
  establish a defect in the main desktop window, but that helper is not accepted.
- No pixel-parity or 1:1 claim is made. Matching, legally captured reference
  images and runtime state evidence remain separate acceptance gates.

### Redistribution boundary

The root distribution uses AGPL-3.0-only for XBuild changes. The original ZCode
Apache-2.0 text is preserved at `licenses/Apache-2.0.txt`; third-party packages
keep their own licenses and notices.

The selected shell's own font notice explicitly denied further distribution of
Anthropic font binaries. Those binaries and their `@font-face` declarations are
excluded. Local system font fallbacks retain the family names used by the shell.
Included OpenDyslexic and Atkinson Hyperlegible Next resources retain their OFL
notices. The preparation script rejects unreviewed binary visual resources.
