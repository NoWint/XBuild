# XBuild Desktop Reconstruction Coverage

2026-11-16 continuation. Status is evidence-based; a visible entry alone is not an executed workflow.

| Case   | Product Surface                                                      | Implementation                                        | Assertion / Execution                                                                                      |
| ------ | -------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| CDR-01 | Window, Sidebar, real new draft, reading rail, composer, both themes | Shared tokens and existing shell partially adapted    | Pending actual Electron case; shared-component browser fixture independently passes, not full-app evidence |
| CDR-02 | 390 / 768 / 1200 / 1440, Sidebar and Side Pane resize                | Existing responsive shell retained                    | Pending actual resize and pane actions                                                                     |
| CDR-03 | Real draft, model/provider/effort, attachment/context menus          | Existing Lexical and configuration owners retained    | Pending complete menu, cancel and draft assertions                                                         |
| CDR-04 | Real Thinking, tool call, stream and completion                      | Existing CLI/Host/V4 projection retained              | Targeted existing provider replay cases not executed in this continuation yet                              |
| CDR-05 | Running/stop, permission, error/retry, background execution          | Existing runtime-derived controls retained            | Targeted runtime acceptance pending                                                                        |
| CDR-06 | Account, Search, all Settings categories                             | Original sources and registered pages retained        | Search/Settings partial pending assertions; account assertions need maintenance                            |
| CDR-07 | Markdown, code, actual file/artifact preview and download            | Original renderers and platform file routing retained | Targeted real-file acceptance pending                                                                      |
| CDR-08 | Theme, locale, UI font, reduced motion, mobile input floor           | Existing settings/broadcast owners retained           | Shared-component fixture passes; actual persisted preference and live-shell assertions pending             |
| CDR-09 | Official same-state screenshots, overlay, pixel difference           | Comparator implemented                                | Reference capture blocked in recovered evidence; no pixel parity score or certification                    |

## Fresh Engineering Evidence

- Node 24.14.0 / pnpm 10.33.2: full `pnpm typecheck` passed; `pnpm lint` passed with 99 warnings and zero errors.
- `node --test scripts/test/desktop-ui-visual-compare.test.mjs scripts/test/desktop-ui-visual-compare.browser.test.mjs`: 101/101, including actual Chromium alpha/overlay checks, zero skipped.
- `node --test packages/ui/test/browser/manual-review/pending/claude-desktop-design-system.test.mjs`: 23/23, including both themes, 390/768/1200 widths, actual overlay content-root focus in forced colors, Markdown roles and reduced motion.
- `pnpm test:engineering packages/desktop/test/tsupChunkIsolation.test.ts`: 20/20. This proves configured sandbox preload bundle closure; it does not prove the application starts.
- Browser fixture screenshots: `packages/desktop/.e2e-artifacts/claude-desktop-design-system/`. These mount actual shared components with synthetic local action handlers and no Agent; they are not Claude-vs-XBuild comparisons.
- Baseline architecture gate: zero violations.
- Current Desktop main/host/preload/renderer compilation completed. The following actual Agent build failed with `ENOSPC` while Core emitted declarations. Native CDR assertions did not execute; this is an environment/build failure, not a passing or failing UI assertion.
- Logs: `packages/desktop/.e2e-artifacts/claude-reconstruction-20261116/`. The independent review found three presentation gaps; their repair and native revalidation remain in progress.

## Completion Rules

Update each row with the passing run artifact and exact executed assertions.
Keep pending/manual-review cases pending until human review; do not silently promote them.
Do not label unexecuted runtime, remote, Windows or Linux behavior as covered.
Final production package must be built from the current source without E2E state bridges.
