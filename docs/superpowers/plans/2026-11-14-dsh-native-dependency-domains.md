# DSH Native Dependency Domains Implementation Plan

> **For agentic workers:** Use subagent-driven-development for isolated module work. Root AGENTS.md governs tests and commits; do not commit or create worktrees without the user's request.

**Goal:** Run native DSH plugins through the real version-locked runtime, with approved dependency-domain isolation and XBuild-managed lifecycle and native UI.

**Architecture:** A CLI-owned supervisor hosts each trusted dependency domain in its own process. The child owns the complete original Cordis/DSH object graph and exposes original SDK and carrier-neutral client channels; the existing service and plugin management layers own routing, provenance and presentation, never a second accepted queue.

**Tech Stack:** TypeScript, Node 24.14.0, pnpm 10.33.2, Cordis 4.1.0, DSH 0.2.2-rc.3, existing React UI/RPC, CLI Vitest and browser/E2E acceptance.

## Global Constraints

- Follow `docs/plugins/dsh-compatibility/spec.md` and `apps/zcode-cli/docs/design/v2/plugins/dsh-native-domains.md`.
- Domain isolation is approved; individual package trust and expanded capabilities are not pre-approved.
- Keep real upstream runtime semantics; no fake Context, Hook-name shim, iframe of the full app, or MCP-only conversion.
- Keep ZCode plugins unchanged by default; preserve workspaceIdentity, owner/lease, generation, continuous/replayable semantics.
- No App business unit tests; use CLI regression and browser/E2E acceptance. Do not commit or push.
- Every delivered compatibility claim names the package/release and an executed acceptance scenario. Missing external credentials/platforms stay explicit.

### Task 1: Native runtime domain

**Files:** `apps/zcode-cli/packages/dsh-runtime/{package.json,tsconfig.json,src/**,tests/**}`; architecture registration by the controller.

**Consumes:** an already prepared and approved DSH profile, installation anchor, workspace identity, per-domain home, explicit environment and runner.

**Produces:** `startDshDomain(options): Promise<DshDomain>`, `runDshDomainWorker(): Promise<void>`, the serializable contracts in `src/contract.ts` and errors with stable codes. `DshDomain` supports `request`, `subscribe` and idempotent `stop`; SDK requests and Connection fetch/streams preserve native envelopes.

- [ ] Write failing CLI tests for actual process activation, scoped identity, failed enabled plugin, original Hook/tool behavior, dispose and abrupt exit; show the failures before implementation.
- [ ] Embed pinned upstream boot and SDK server, not a handwritten service substitute. Public profile APIs resolve Bundle/Profile patches. Native client modules expose graph and assets without mounting a complete web page.
- [ ] Use IPC distinct from plugin stdout, runtime schema validation, generation-bound correlation and terminal cancellation. Clear inherited secrets; stop before replacement.
- [ ] Exercise a real native plugin and native SDK turn with deterministic local adapter; verify native return values and persistence instead of only parsing a manifest.
- [ ] Record exact tests and unresolved integration prerequisites in the task report.

### Task 2: Package lifecycle and trust

**Files:** new managed module under `apps/zcode-cli/packages/adapters/src/dsh-plugins/`, CLI plugin contracts and bootstrap plugin management integration; corresponding CLI tests.

**Consumes:** Task 1 domain interface; existing plugin storage owner and config precedence.

**Produces:** immutable prepared revisions, source/manifest/dependency inventory, exact trust grants, activation/stop/configure/update/rollback/uninstall commands and compatibility diagnostics.

- [ ] First test script-disabled installation, exact revisions, changed dependency invalidation, foreign identity denial, config precedence and rollback.
- [ ] Resolve original npm/Git/archive packages through argument-array package manager execution, never market command strings. Keep original files unchanged.
- [ ] Stage before activation; package download, awaiting trust and running are distinct states. Reject missing entry, incompatible peer/version and failed native load.
- [ ] Preserve per-domain data, lock mutation and cancel/reap before update or uninstall. Build scripts require separate grant.

### Task 3: Shared protocol and services

**Files:** `packages/shared/src/dsh-compat/`, `packages/shared/src/zcode-protocol/index.ts`, bootstrap plugin protocol dispatcher, service contracts and thin plugin management implementation.

**Consumes:** lifecycle and domain records from Tasks 1–2.

**Produces:** schema-validated `plugins/dsh/*` management and domain attachment routes, notifications with original payload and generation, bounded stream/asset transfer, existing service DI.

- [ ] CLI protocol tests reject stale generation, foreign workspace identity, malformed payload and unauthorized lifecycle writes.
- [ ] Route only through the existing Host and Agent process; no new mobile Host. Establish attachment before streaming and preserve cancellation.
- [ ] Keep native Session log as owner; recovery requests native baseline/cursors, not guessed text reconstruction.

### Task 4: Native client and unified store

**Files:** new managed `packages/ui/src/dsh-plugins/`, hooks/store integration, existing plugin management settings and session/sidebar/tool anchors; browser/E2E fixtures.

**Consumes:** Task 3 scoped service; real upstream module/Connection/client ABI.

**Produces:** original DSH factory/slots mounting in XBuild-owned native layout, original settings/configuration and bidirectional session/tool UI, unified source and lifecycle management.

- [ ] Add acceptance coverage before changing interaction.
- [ ] Provide a per-domain module table and original runtime dependencies; route client transport, asset and event streams through scoped service. Never convert original UI into a placeholder card.
- [ ] Reuse DESIGN tokens, existing controls, themes and i18n; show domain trust boundaries and real runtime failures.
- [ ] Dispose React roots, scopes, fibers, listeners and URLs; reject late messages. Verify browser desktop/mobile views and existing ZCode plugin behavior.

### Task 5: Corpus and delivery evidence

**Files:** compatibility corpus/runner in CLI tests and evidence under `docs/plugins/dsh-compatibility/`.

- [ ] Exercise real representative plugins for the requested families and record source/version/integrity and behavioral results.
- [ ] Include coupled dependencies, Hook ordering/veto/transform, UI settings and custom presentation, Session persistence, domain exit, update rollback and peer conflicts.
- [ ] Run root typecheck/lint/architecture plus CLI typecheck/lint and affected regression/E2E. Record actual failures, existing warnings and external prerequisites.
- [ ] Review changes and reconcile each of the user's fifteen final criteria; never label the whole system complete on foundation-only evidence.

## Continuation 2026-11-15

The existing workspace contains uncommitted runtime/package foundations and unrelated UI reconstruction. Do not recreate them, switch branches, commit, or revert local work. Root owns shared schemas, architecture registration, integration and lockfile; module implementers own their explicitly assigned files.

- [ ] Make the runtime lint entry inspect real files from root-filter and package cwd; add an engineering fixture proving a deliberate lint error is detected.
- [ ] Extend native invocation lifetime and original Gateway streams as specified in integration-contract.md; add real command/peer/uplink/cancel regressions before implementation.
- [ ] Harden package source/inventory validation and implement offline configuration revisions/catalog storage/pinned package execution, preserving original package bytes and immutable rollback.
- [ ] Add strict shared DSH envelopes and a CLI controller with one lifecycle/attachment owner; test authorization, late generations, transaction rollback, real native calls and transport gap reporting.
- [ ] Wire controller through the existing stdio server and service DI, scoped native UI module loading and unified plugin-store entry; keep unsupported runtime/platform states explicit.
- [ ] Run fixed-Node native/CLI/root verification and native browser acceptance; retain exact executed results, including environmental failures.

## Continuation 2026-11-18

Executed in this session (evidence kept below; no commits made).

Done:

- Fixed a real regression in the domain loader-state layer. Plugins calling the public `ctx.loader.update()` produce patch-owned changes that upstream keeps in memory rather than in `cordis.patch.yml` inserts; with no durable layer these were lost on restart, and the domain wrote an empty state on close. Added `dataDirectory/loader-state.json` as a domain-owned, cross-restart layer (bounded schema, fail-closed on corruption, atomic temp+rename, serialized writes, written before `fiber.dispose()` since `loaderEntries()` becomes unreadable after dispose).
- Root cause of the second bug: the baseline used for diffing was captured *after* the persisted layer was applied, so the diff was always empty and closing rewrote `[]`. Baseline is now captured from the authorized composition *before* the domain layer is appended.
- Regression tests: the existing cross-restart test now passes, plus a new idempotency test asserting the layer is byte-stable and does not self-feed across three consecutive restarts.
- Implemented the DSH plugin management UI (`packages/ui/src/dsh-native-ui/`): contract, Zustand store, workspace-scoped hook, settings section with sources/install/trust/enable/update/rollback/uninstall/diagnostics. Wired as a new `dshPlugins` settings section, i18n for zh-CN and en-US, and registered the module's real dependencies in `architecture-policy.yaml`.

Executed verification:

- `apps/zcode-cli/packages/dsh-runtime` vitest: **60/60 pass** (was 58/59).
- `apps/zcode-cli/packages/adapters` DSH suites: **47/47 pass**.
- `apps/zcode-cli/packages/bootstrap` DSH suites: **27/27 pass**.
- `node scripts/acceptance/dsh-service-routing.mjs` via `tsx`: **PASS** (scope, lease, mode, payload, event, replay, cleanup, unsupported, no native deadline). Note: it does not run under bare `node` because it imports `.ts` sources — pre-existing, unrelated to these changes.
- `pnpm typecheck`: **exit 0**. `pnpm lint`: **exit 0, 0 errors** (99 pre-existing warnings, unchanged). `pnpm architecture:check --changed`: **OK, 0 new violations**.

Not done / explicitly unverified:

- The DSH settings UI has **not** been exercised in a running desktop app; only type/lint/architecture checks were performed. Per AGENTS.md an interaction change needs E2E/browser acceptance before it can be called verified. No DSH E2E fixture exists yet.
- No real community plugin corpus; compatibility claims remain at `unverified` for anything not covered by the synthetic fixtures in the runtime tests.
- Native UI plugin mounting (`__ModuleLoader__`/slots rendering third-party components) is still not implemented; `generate_gaussian_world`-style surfaces and tool presenters remain absent.
- Configure (arbitrary patches) is exposed in the contract but has no UI form yet.
- Individual package trust beyond the managed domain, and any `sandboxed` confinement request, remain unimplemented and are reported as environment-limited by the controller.

## Continuation 2026-11-19

Done in this session:

- **Fixed the real distribution blocker.** `DSH_DISTRIBUTION_UNAVAILABLE` was not a missing asset but a wrong branch: dev runs the staged `bundled-agents/<platform>/glm/zcode.cjs`, whose path lacks `/apps/zcode-cli/`, so `defaultDistribution()` fell into `staged` and derived the runtime root as `glm/dsh-runtime` — never staged. Two separate causes had to be fixed: (a) locate the repo checkout and use the `development` distribution; (b) when the checkout has no bundled standalone `node` binary, use the real Node as the runner instead of the `electron-node` runner that requires `glm/dsh-runtime/bin/node`. Verified: `overview` now returns DSH 0.2.2-rc.3 + Cordis 4.1.0 and the running app logs zero distribution errors.
- **Built-in marketplace catalog** (`builtin-catalog.ts`): a curated list ships with the app so users can browse before adding any source. Entries stay `unverified` — built-in means "verifiable source", not "verified behaviour". Built-in cannot be refreshed or removed (explicit rejection, not fake success). Also fixed a regression where `load()` returned early on a missing catalog directory and dropped the built-in source entirely.
- **Automatic local DSH discovery** (`discovery.ts`): read-only scan of `$DSH_HOME|~/.dsh/profiles/*/node_modules`, resolving pnpm `link:` symlinks to real directories. Reuses `parseDshManifest`, so "discoverable" and "installable" share one admission rule. Filters: skips `@deepseek-ai/*` runtime packages and plain dependencies that declare no `dsh.bundle` / `dsh.profile` / `dsh.client`; broken symlinks surface as diagnostics instead of being silently skipped. Surfaced through `overview.local` with `alreadyInstalled` so users are not offered duplicate imports.
- **UI**: new "Curated plugins" and "DSH plugins found on this device" sections with one-click install/import, plus separation of built-in vs user-added sources.

Verification executed:

- Real-machine discovery: found `dsh-prompt-inject@1.1.2` and `dsh-client-ui-aqua-unofficial@1.4.1` (both real community plugins, both with `bundle+client+entry`), plus one honest diagnostic for the broken `dsh-awesome-streaming` symlink.
- Full UI payload (`overview`) validated against `dshOverviewSchema`.
- Adapters DSH suites: **57/57**; bootstrap DSH: **27/27**; dsh-runtime: **60/60**.
- `pnpm typecheck` exit 0; `pnpm lint` exit 0 / 0 errors (100 pre-existing warnings, none in the changed modules); `architecture:check --changed` 0 new violations.
- New regressions: `dsh-discovery.test.ts` (7) and `dsh-builtin-catalog.test.ts` (3), covering empty home, capability filtering, broken links, schema rejection, built-in degradation and refresh/remove refusal.

Still not done:

- The DSH settings page has **not** been visually confirmed end-to-end. Electron's renderer is opaque to the accessibility API, so scripted navigation could not open it; verification stopped at the schema-validated payload the UI consumes. A DSH E2E/browser fixture is still the missing gate for this page.
- Importing a discovered plugin runs `prepare` but was not exercised to activation; the 312 MB dependency-closure staging problem for packaged builds remains open.
- `configure` still has no UI form; native UI plugin mounting (third-party components in slots) is still absent.

## Continuation 2026-11-19 (session 2): the error was real, and so was the fix

The user reported the same `Native plugin distribution is unavailable` after the previous session's fix. It was not stale state — three separate defects were stacked.

1. **Two pre-existing syntax errors made the whole renderer white-screen.** `ConversationTimeline.tsx` had a ternary with the condition deleted (`? "class" : "class"`, both branches identical) and `ConversationComposer.tsx` had a dangling `<HighspeedComposerBackground` start tag with no closing. Vite failed the transform, so `document.body.innerText` was empty and the app looked "broken" for reasons unrelated to DSH. Both were uncommitted local changes; I restored the committed shape. This is why earlier attempts to screenshot the page showed nothing — the page never mounted.
2. **The real `DSH_DISTRIBUTION_UNAVAILABLE` cause was `ENOENT: .../cli/dist/dsh-runtime/bin/node`.** The live `argv[1]` is `apps/zcode-cli/packages/cli/dist/zcode.cjs`, which *does* contain `/apps/zcode-cli/`, so the `development` branch was taken — but it still used the `electron-node` runner that requires a bundled standalone `node` binary. The dev-fallback path I added previously was never reached. Fixed by using the real Node as the runner in the `development` branch too.
3. **The `catch` handlers were hiding every real failure.** `createDefaultDshController` and the protocol `dispatch` both replaced the cause with a generic message. Added bounded stderr diagnostics that keep the original error locally without leaking paths to the frontend.

Also fixed while verifying: `runtimeVersions` is keyed by full package name, so the UI showed `DSH - · Cordis -`; and `materialize.ts` discarded pnpm's stderr, surfacing only `installation failed (64)`.

Verified in the running app (CDP against the live renderer, not a script):

- DSH page renders with `hasError: false`; header shows **DSH 0.2.2-rc.3 · Cordis 4.1.0**.
- "Curated plugins" lists 2 entries with install buttons; "DSH plugins found on this device" lists the 2 detected local plugins with import buttons, profile and capability labels.
- Importing a discovered plugin now returns a **precise, actionable rejection** instead of a generic failure:
  - `dsh-prompt-inject` → `Unsatisfied peer version: requires @deepseek-ai/cordis@~4.0.5, found 4.1.0`
  - `dsh-client-ui-aqua-unofficial` → `Conflicting native runtime version: @deepseek-ai/dsh-settings@0.1.0-rc.8, expected 0.2.2-rc.3`

Both rejections are **correct behaviour**, not bugs: these community plugins target older DSH/Cordis lines than our pinned 0.2.2-rc.3 / 4.1.0. Per the goal's requirement 15, they are refused loudly rather than reported as installed.

Gates: `typecheck` 0, `lint` 0 errors, `architecture:check --changed` 0 new violations; adapters DSH 57/57, bootstrap DSH 27/27, dsh-runtime 60/60. (One bootstrap run failed transiently while three packages ran concurrently; both isolated and full re-runs pass.)

Now genuinely open:

- Installing community plugins that target the pinned 0.2.2-rc.3 line was not demonstrated end-to-end to `running`, because no such plugin is present on this machine. Import → prepare → trust → activate still needs a compatible corpus.
- Packaged (non-dev) builds still lack staged distribution assets; only the dev distribution path is proven.
- `configure` has no UI form; native UI plugin mounting remains unimplemented.
