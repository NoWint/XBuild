# Desktop Build Validation

2026-11-15. Record actual build blockers and regression commands independently of visual coverage.

## Validation Dependency Identity

The current Desktop database-startup contract directly imports `zod`, but its
package did not declare that dependency. The hoisted installation resolved
Desktop to root Zod 4.6.6 while the public shared schemas resolve Zod 4.6.5.
`workerMessageSchema` composes those public shared children into the Desktop
schema and exports its inferred type. Composite declaration emission rejects
that mixed identity with seven `TS2883` errors referring to shared's internal
Zod types.

Evidence:

- `packages/desktop/src/host/database-startup/contract.ts`: direct `zod` import and exported composed schema.
- `packages/desktop/package.json`: previously no direct dependency.
- `packages/shared/package.json`: existing exact `zod` 4.6.5.
- Package-scoped resolution: Desktop -> root 4.6.6; shared -> local 4.6.5.
- Fixed Node 24.14.0 `pnpm typecheck`: exit 2, seven `TS2883` errors at that exported schema.

The repair declares Desktop's already-used Zod 4.6.5 dependency and lets pnpm
resolve the importer. It adds no new runtime framework, changes no validation
shape or protocol, and does not widen types with `any` or a generic schema
annotation. Preserve all unrelated DSH and lockfile changes.

Regression: run full `pnpm typecheck` after install, then `pnpm lint` and
`pnpm architecture:check --changed`. A passing declaration build must be
recorded before claiming the blocker is resolved. Native/E2E bundles must be
built only after typecheck has finished because it writes `out/host`.

The Desktop repair passed fixed-Node full typecheck and architecture checks.
The interrupted install first failed with `ENOSPC`; a frozen-lockfile install
limited by command-line `--os=darwin --cpu=arm64` completed without changing
the repository's supported-platform configuration.

## Agent Bundle Dependency Identity

The subsequent current-source Agent build reached CLI esbuild after building
bootstrap and the required plugin runtimes. The existing Zod dedupe guard then
rejected three Core consumers: deferred-tool-call, topic-resource and
topic-archive. They directly import `zod`, but Core did not declare it and
resolved root 4.6.6 instead of the shared 4.6.5 identity.

Apply the same dependency-ownership repair to `apps/zcode-cli/packages/core`:
declare its already-used exact Zod 4.6.5 dependency. Do not relax the dedupe
guard, restore a removed type alias, rewrite Runtime validation, or globally
override unrelated peer packages. Rebuild the Core and Agent chain through
their existing commands; the final CLI and staged bundle must be newly
generated before running Electron acceptance.

## Clean Agent Build Order

`scripts/build-desktop-agent-cli.mjs` owns the ordered local workspace build
list. Bootstrap now declares the public `@zcode/dsh-runtime` dependency and
imports its exported types; that package exposes generated `dist` entries.
An earlier successful Agent validation needed a separate DSH prebuild because
the explicit list did not build DSH before Bootstrap. Existing local `dist`
files must not be a prerequisite for this entry script.

The normal pnpm path and `ZCODE_BOOTSTRAP_WITH_REMOTE=1` bare-tsc path must
derive their order from the same list, including DSH before Bootstrap. Turbo
mode remains delegated to its workspace dependency graph. Preserve the
dynamic-workflow prepare step, build environment, CLI Zod dedupe guard,
required plugin runtime checks, and Agent/CUA staging.

```text
build entry (single order owner)
  -> workspace prerequisites -> DSH dist -> Bootstrap dist
  -> CLI bundle -> Agent staging -> CUA staging
turbo entry -> existing dependency graph -> CLI bundle -> shared staging
```

Engineering acceptance runs the real entry script in a temporary workspace
with the actual DSH/Bootstrap public manifests and a real TypeScript compiler.
With no DSH `dist`, Bootstrap must fail with `TS2307` before the repair; after
the repair both explicit paths must compile and stage newly generated output.
The same harness checks Turbo delegation/staging and that a missing required
MCP artifact still blocks the normal path. Controlled native/plugin subprocess
fixtures do not establish a clean actual Agent build; record that separately
from the full build owner.

Regression: fixed Node 24.14.0
`node --test scripts/test/build-desktop-agent-cli.test.mjs`.

## Sandbox Preload Dependency Closure

The isolated current-source Electron run emitted `preload-error` with
`module not found: zod` at `preload/index.cjs`. Its window retained
`sandbox=true`, `contextIsolation=true`, and `nodeIntegration=false`.
Because preload stopped before exposing `window.zcode`, the renderer entry
rejected while reading `printPageToPdf` and left the React root empty. This
is a build dependency-closure failure, not a delayed onboarding condition.

Evidence:
`packages/desktop/.e2e-artifacts/desktop-e2e-20261114191645708-p35359-6f2e4c3586b043bf/cdr-startup-failure.json`.

The Desktop dependency declaration fixes Zod type identity but also makes
tsup externalize Zod by default. Shared runtime schemas are inlined into the
preload, while their `require("zod")` cannot be resolved by Electron's sandbox
preloadRequire. The preload configuration is the single owner of this bundle
closure: inline the existing Zod dependency alongside shared, leaving all
other entrypoints' externalization unchanged.

```text
preload config -> shared runtime schemas + inlined Zod -> sandbox execution
  -> contextBridge exposure -> renderer entry
```

Keep Zod 4.6.5 identity, schema validation, CJS output, all preload entries,
production minification/no sourcemaps, build-ready ordering, and window
security options unchanged. Do not make platform bridge access optional or
disable sandbox isolation.

Engineering acceptance builds the actual configured preload entries into
disposable directories in development and production modes, with shared
schemas unchanged. Execute the real index artifact under Electron's allowed
sandbox require boundary. It must expose the platform bridge, forward a valid
database-startup port payload, and reject/close invalid payloads. Externalized
Zod must fail this same execution before the repair. No source-text assertion
or new constant alone establishes this contract.

Regression: fixed Node 24.14.0
`pnpm test:engineering packages/desktop/test/tsupChunkIsolation.test.ts`.
The harness establishes bundle closure and validation behavior, not native UI
startup. Full Desktop build, actual isolated Electron acceptance, root
typecheck/lint, and packaging remain separate evidence owned by Task 6.

## Build Evidence

Native build, isolated Electron acceptance and production `.app` records will
be added from their actual completed runs. No old `out`, DMG or ZIP counts as
the current source build.
