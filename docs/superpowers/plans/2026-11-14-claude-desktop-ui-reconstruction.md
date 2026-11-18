# Claude Desktop UI Reconstruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use subagent-driven-development / Workflow for bounded implementation and independent review. Steps use checkbox tracking; user authorized autonomous continuous execution in this session, without phase approval gates.

**Goal:** Apply a legally reimplemented, complete desktop presentation system to the real XBuild UI while preserving every native runtime/configuration capability and producing reproducible acceptance/build evidence.

**Architecture:** Change shared CSS and existing presentational components only. Root/Host/runtime/CommandInbox, provider routing, DSH, workspace identity, accepted input, replay and ownership remain unchanged. Existing live hooks/projections continue to supply all product data.

**Tech Stack:** React 19, Tailwind 4, Radix, Zustand, Lexical, Streamdown, Lucide, Electron, WDIO/Playwright and the current public Jimp dependency for engineering image processing.

## Global constraints

- Spec first: `docs/superpowers/specs/2026-11-14-claude-desktop-ui-reconstruction-design.md`.
- Measurement provenance: `docs/design/claude-desktop-reconstruction/reference-measurements.json`; no claim that all static branches are active.
- Node 24.14.0 / pnpm 10.33.2; preserve unrelated DSH working changes and do not commit/push/publish.
- No copied closed source/fonts/brand assets, no Claude WebView, no final mock UI, no second runtime/store or business writing path.
- UI text uses declared `text-ui-*` roles; existing UI font preference and mobile 16px input floor remain. Colors/geometry/motion have one shared CSS source.
- App unit tests are retired. Add browser/Electron acceptance and engineering tooling tests, not App test/spec/contract.test.ts.
- Never start native build and root typecheck concurrently: typecheck can overwrite `out/host` bundle output.
- No 1:1 or pixel-difference success claim without matching legal reference screenshot/metadata.

## Files and responsibilities

| Area | Files | Responsibility |
| --- | --- | --- |
| Design | `DESIGN.md`, `packages/ui/src/styles.css`, new `packages/ui/src/desktop-design-system.css` | Semantic palette, role typography, shared geometry/motion, component visual contracts |
| Shell | `packages/ui/src/app-shell/WorkspaceShellLayout.tsx`, `DesktopWindowFrame.tsx`, `DesktopTopOverlay.tsx`, `WorkspaceHeader.tsx`, `WorkspaceHeaderSections/WorkspaceHeaderActionSection.tsx` | Default sidebar/header/frames and visible navigation, native/window/pane behavior unchanged |
| Sidebar | `packages/ui/src/project-sidebar/ProjectSidebarNavigation.tsx`, `ProjectSidebarListHeader.tsx`, `ProjectNodeContent.tsx`, `TaskListItem.tsx`, `WorkspaceSidebarFooter.tsx` | Navigation/list density, hover/active/focus and account shell; original actions and actual data unchanged |
| Chat | `packages/ui/src/v4/conversationLayout.ts`, `ConversationDraftEmptyState.tsx`, `ConversationTimeline.tsx`, `ConversationComposer.tsx`, `ConversationUserInputBubble.tsx`, `ConversationRowView.tsx`, existing Thinking/tool renderers | Actual draft, reading rail, messages/thinking/tools/content/actions |
| Composer | `packages/ui/src/prompt-editor/ChatPromptEditor.tsx`, existing toolbar presentation files | Shared shell/attachment/model-menu styling; Lexical/config/commit pipeline unchanged |
| Settings/overlays | `packages/ui/src/SettingsPage.tsx`, `settingsPageHelpers.tsx`, `components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `dialog.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `select.tsx`, `tooltip.tsx`, `command-center/CommandCenterDialog.tsx` | Complete existing configuration views and accessible shared overlays |
| Acceptance | new `packages/desktop/test/e2e/ui-shell/manual-review/pending/claude-desktop-reconstruction.test.ts`, existing targeted E2E where proportions intentionally change | Setup → real actions → DOM/computed-style/screenshots with no invented runtime states |
| Visual engineering | new `scripts/desktop-ui-visual-compare.mjs`, `scripts/compare-desktop-ui.mjs`, `scripts/test/desktop-ui-visual-compare.test.mjs`, root `package.json` scripts | PNG comparison, local report/overlay/diff, honest metadata validation |
| Delivery | `docs/design/claude-desktop-reconstruction/{research,coverage,visual-report,README}.md`, local ignored build/evidence directories | Traceable coverage, limitations, commands and runnable build |

## Task 1 — Engineering visual comparison

**Consumes:** `docs/design/claude-desktop-reconstruction/visual-validation-spec.md`; current public `jimp` dependency resolved from CLI adapters `package.json`, not internal adapters code.

**Produces:** asynchronous `compareDesktopImages({referencePath,candidatePath,outputDirectory,threshold,maxDifferenceRatio,referenceMetadataPath,candidateMetadataPath,ignore})` and the specified CLI.

- [ ] Write `scripts/test/desktop-ui-visual-compare.test.mjs` first, constructing literal 2×2 PNGs with public Jimp. Test help, zero/one pixel, alpha visibility, masks, metadata mismatch, bad input/threshold, bounds and refusal to overwrite.
- [ ] Run `node --test scripts/test/desktop-ui-visual-compare.test.mjs`; record RED against missing implementation, not a malformed fixture.
- [ ] Implement the two scripts using async IO, deterministic outputs, HTML escaping and complete rollback/error reporting. Do not touch UI or unrelated package/lock files.
- [ ] Run the same tests GREEN. Independent reviewer refutes false-positive match/certification/overwrite/alpha claims.

## Task 2 — Acceptance contract before product edits

**Consumes:** actual WDIO `bootstrapApp` / sidebar / prompt helpers and existing test IDs, current specs/catalog/coverage.

**Produces:** a pending acceptance case for CDR-01–08; reference CDR-09 remains explicitly blocked until screenshot access.

- [ ] Add accepted CDR rows to the current conversation case catalog and coverage matrix, with pending rather than covered status.
- [ ] Add the new UI-shell pending WDIO case. Assert actual 1200×800 light/dark, empty draft, menu keyboard/escape, sidebar/default reading rail, settings/account/search, retained toolbar actions, narrow layout, font/geometry separation and reduced motion. Runtime status checks use real existing provider replay/CLI pipeline, never direct fabricated UI rows.
- [ ] Run the visual layout case on the baseline and record the expected old geometry/token failure. If app startup is blocked, record it rather than calling RED a design failure; fix only owned test setup.
- [ ] Maintain existing geometry assertions when a specified proportion changes, while keeping lifecycle/focus/runtime assertions intact.

## Task 3 — Shared design system and primitives

**Consumes:** no new state API. Existing `--color-*`, `--ui-font-size`, theme IDs and platform classes.

**Produces:** CSS semantic interface: `--desktop-sidebar-width`, `--desktop-header-height`, `--desktop-reading-width`, `--desktop-composer-radius`, `--desktop-duration-*`, and presentational `xb-*` roles consumed by later tasks.

- [ ] Update DESIGN and the affected current theme/workspace specs before product CSS.
- [ ] Add explicit `text-ui-prose`/`text-ui-welcome` roles only where product content needs them; preserve current scale and independent code/diff/terminal sizes.
- [ ] Implement CDS-referenced neutral light/dark layer mapping, normal/hover/active/disabled/focus colors, restrained shadows and reduced-motion in shared CSS. Preserve semantic status and remote/workflow contrast boundaries.
- [ ] Restyle shared Button/Input/Select/Menu/Popover/Dialog/Tooltip using existing Radix behavior; do not remove focus traps, interaction stacking, menu shadows or close controls.
- [ ] Expose the reusable stylesheet through the existing UI package public surface without adding runtime/dependency/state modules. Pure CSS owns presentation; any new executable source requires architecture adoption first.

## Task 4 — Real shell/sidebar and New Chat

**Consumes:** existing component props/hook actions; new shared CSS roles. No new business method.

**Produces:** the full operational XBuild shell with measured default proportions and actual new-draft start.

- [ ] Set new default sidebar 288px while retaining stored/custom widths, minimum-content guard, pointer/keyboard resize and existing persistence.
- [ ] Align header/frame/list controls with shared geometry; preserve OS traffic lights/window controls, drag regions, terminal, Side Pane/tab persistence and responsive overflow.
- [ ] Use original sidebar navigation/search/list/group/project/task/menu sources, adding presentational role classes rather than a replacement fake list. Keep Automations/Plugins/remote/project management discoverable.
- [ ] Recompose `ConversationDraftEmptyState` and the actual centered composer into a restrained serif voice heading and real editor surface. Preserve workspace/project/purpose/plugin suggestions and draft placement; WelcomeScreen remains the API-key/auth page.
- [ ] Refine footer/account menu and search shell while preserving current user/auth/config facts and key/ID copy errors.

## Task 5 — Live conversation, composer, settings and files

**Consumes:** actual V4 `ConversationProjectionStore`, current composer/config callbacks and existing file/platform interfaces.

**Produces:** polished real message/tool/artifact/settings components with no runtime change.

- [ ] Unify 768px reading/composer rails and responsive gutters through `conversationLayout`; preserve actual full-pane/split/resize preferences and virtual scroll anchors/live-tail behavior. Source audit confirmed there is no conversation wider/full setting; do not invent one.
- [ ] Restyle user bubble and assistant rows; Markdown/code/table/citations keep actual Streamdown/code/action components and configurable content sizes.
- [ ] Restyle Thinking/tool expanders and streaming/error/permission/background cards based solely on current projection. Do not fabricate elapsed time, CoT, results or execution states.
- [ ] Align Lexical editor/attachments/+ and model/effort toolbar shell. Preserve IME, Enter/Shift+Enter, mentions/slash, upload transaction/gates, model registry capabilities and busy admission.
- [ ] Recompose existing Settings navigation/content/sections without dropping any registered config page or remounting underlying chat. Keep plugin/MCP/DSH/native provider/remote/config entry paths.
- [ ] Align existing artifact/file/preview/terminal/browser/diff frames with same system; retain real open/download/permissions and mobile drawer behavior.

## Task 6 — Verification, review and build

- [ ] Run locked-Node `pnpm typecheck`, `pnpm lint`, `pnpm architecture:check --changed`, changed-file formatting and visual engineering tests. Record real warning/error counts; no baseline masking.
- [ ] After typecheck is finished, build actual desktop and Web. Use isolated HOME/data and existing production runtime-asset flow; do not test against personal profile.
- [ ] Execute pending CDR acceptance and targeted existing sidebar/project/composer/Thinking/tool/search/pane tests through verified package entry points. Use replay fixtures only for test upstream; production data providers remain native.
- [ ] Inspect real screenshots and computed styles in light/dark and 390/768/1200/1440 widths; fix clipping/misalignment and re-run affected assertions.
- [ ] Independently review UI feature preservation, identity/ownership, accessibility, reduced-motion, shared token layering and test truthfulness; verify findings and fix confirmed issues only.
- [ ] Produce coverage/visual report with actual artifact paths. If legal same-state Claude screenshots remain unavailable, deliver comparator and XBuild evidence but keep reference-capture and 1:1 certification explicitly blocked.
- [ ] Produce a local runnable XBuild build and run/open its real window. Deliver complete documentation and build artifact, with no unauthorized commit, push, PR or distribution.

## Self-review

All five user phases map to the tasks above: research evidence → shared design → real full UI → native mapping → acceptance/diff/build. The only externally blocked evidence is authenticated/screen-capture reference observation; it is not replaced by a mock or an OSS claim. Parallel workers touch disjoint presentation/tooling files and no runtime/provider/DSH files; final typecheck/build/E2E run serially where outputs share directories.
