# cli-dsh-controller

CLI-owned DSH management, native lifecycle and attachment admission. Packages own immutable revisions and trust; the native worker owns Cordis, Agent, Session, inbox and persistence.

- Downloaded, trusted, enabled and running are distinct states. Only a completed native start can publish running.
- Mutations serialize per domain; replacement waits for actual exit. Failed activation does not replace active revision and restores the retained old revision under a new generation when possible.
- Every attachment has an opaque token, scope, revision, generation and native Peer. Invoke/answer/cancel/detach only act on that lease.
- A receipt does not release a call. Original settlement, stream terminal or native exit releases admission.
- Transport replay is bounded and explicitly reports gaps; it does not own Session history.
- No OS confinement is implied by process isolation. Unsupported narrower grants fail closed.
- ZCode Session/V4 and plugin parsing are not changed.

Every dispatch has an owner AbortController combined with caller cancellation.
Shutdown synchronously closes admission and aborts operations, then drains
already-admitted filesystem IO and mutations before stopping native domains.
Preparation has no domainId requirement for cancellation ownership. Publication
checks cancellation after digest IO and before metadata/pointer admission.

```text
protocol request -> strict schema -> lazy singleton controller -> package/native
disconnect/close -> close admission -> owner abort -> drain IO -> native stop
late factory -------------------------------------> shutdown, never subscribe
```

`createDefaultDshController({ cliStorageRoot, distribution? })` is a launcher
assembly contract, not a UI/request option. Development uses the executing CLI
anchor inside the checked-out `apps/zcode-cli` tree and verifies public package
metadata within that checkout. Staged resources use an explicit companion root:
`package.json` for `@zcode/dsh-runtime`, `dist/index.js`, `dist/worker.js`,
`dist/worker-entry.js`, the runtime's complete `node_modules` closure, and
`node_modules/pnpm/{package.json,bin/pnpm.cjs}` at version 10.33.2.
Installation anchor and runtime dependency root share the same directory.
The advertised runtime inventory follows declared DSH/Cordis dependencies,
verifies fixed installed versions, and exposes only names resolvable from that
anchor. It does not scan arbitrary ambient or global packages.

Node runners use an explicit executable. Electron uses `ELECTRON_RUN_AS_NODE=1`
for the native worker and requires a separate explicit Node executable for pnpm;
default staged location is `bin/node` (`bin/node.exe` on Windows). SEA has no
delivered worker/bootstrap closure in this slice and is rejected. Missing,
out-of-root, mismatched or incomplete assets return
`DSH_DISTRIBUTION_UNAVAILABLE`. A passing development regression is not a
packaged Desktop, Windows, Linux or SEA compatibility claim.

`uninstall(deleteData: true)` currently refuses with
`DSH_NATIVE_DATA_MAINTENANCE_UNAVAILABLE` before revoking a running attachment
or writing metadata. The pending deletion port must hold an exclusive
maintenance lease from the persistent native data owner across the whole
deletion. Volatile controller failures are retained diagnostics, not authority
to erase an ownership/quarantine marker. Keeping native data remains available
through the existing non-deleting uninstall path after confirmed stop.
