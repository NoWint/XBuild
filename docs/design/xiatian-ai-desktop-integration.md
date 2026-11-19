# Xiatian AI desktop integration and bounded guest access

Status: approved product direction on 2026-11-19; implementation and production acceptance are separate.

## Ownership

- Xiatian AI owns user identity, scoped dashboard access tokens, guest grants,
  notices, public model/channel availability, quota and usage counters.
- The XBuild Agent provider configuration owns model endpoints, model selection
  and the credentials used for model requests. Third-party providers are peers,
  not children of the Xiatian AI account and must survive sign-out.
- The desktop bridge owns encrypted-at-rest client credentials and the mapping
  from a signed-in account to that user's provider. It never receives admin keys.
- Existing window Host, command admission, task scheduler, workspace identity
  and remote attachment semantics are not replaced by this integration.

```text
XBuild device request → server stores public request digest → browser login/consent
  → scoped user token issued to the device → profile/models/usage projection
  → server issues a short-lived, user-bound relay key → the agent calls the relay with it

Anonymous installation → short guest grant → model/group/protocol checks
  → per-grant and per-IP budget → ordinary channel selection and usage accounting
```

No static administrator or user API key is shipped in a client. An account token
has `profile:read`, `api_key:read`, `api_key:reveal` and `usage:read` scopes; a
normal Xiatian API key can be supplied directly instead. Device authorization is
short-lived, single-use, rate-limited and cannot grant additional permissions.

## Relay credential

The dashboard token is a control-plane credential: it reads the account and
authorizes desktop actions. It is never sent to the relay as a model credential,
because relay authentication is where per-key quota, model access, group
selection and audit are decided, and a dashboard token would bypass them.

Model requests therefore use a relay key that the server issues for the signed-in
user (`POST /api/xbuild/session-key`): the user's own group, charged against the
user's own balance, limited to a bounded lifetime and revoked when the desktop
signs out (`DELETE /api/xbuild/session-key`). Rotation keeps the previous key
alive for a grace window so in-flight streams still settle, and the desktop
re-issues the key when it approaches expiry. If the key cannot be issued, the
account panel says so instead of silently falling back to another credential.

## Guest entitlement

Guest access is disabled unless the operator explicitly configures a free model
allowlist and a fixed free group. Only that allowlist, group and supported text
relay protocols are available. Client model lists, aliases, virtual routes and
retries cannot override these checks. Requests get small body/output ceilings,
per-grant and per-IP request/token budgets, a global anonymous kill switch and
limited concurrency. The token is a short, random, revocable grant whose digest
is stored, not a credential for an administrator or shared human account.

Every relay authentication path must accept the guest grant or reject it before
channel selection; model-mapping and alternate protocols cannot turn it into a
paid-model credential. The fixed group is reapplied during retries. Anonymous
costs are bounded separately from the public price shown to users. No private
channel names, upstream credentials or user data are exposed by the guest catalog.

The user-provided example model IDs are candidates, not proof of zero upstream
cost. Production enablement requires measured provider availability and an
explicit budget/allowlist. A failure to issue a grant must not silently fall back
to an unrelated paid provider or claim a completed response.

## Desktop account and provider behavior

- Replace GLM/Z.ai/BigModel sign-in choices with Xiatian AI account sign-in and
  an explicitly labelled Xiatian AI relay API-key option. Generic third-party
  provider templates remain available; this is not a GLM-only client.
- Show profile name, quota, used quota and request count from `/api/user/self`;
  API-key metadata and usage from the existing token endpoints. Reveal keys
  only after the user's scoped authorization and never log their full values.
- The default Xiatian provider uses the OpenAI-compatible template against the
  user's own group and models, and becomes the default model only when no
  explicit third-party choice exists. Users can edit model IDs, add
  OpenAI-compatible providers and select models independently.
- Public notices come from `/api/notice` and `/api/status`. Channel availability
  uses only public status/performance data, not admin channel details. A
  `What's new` surface is a presentation of those notices, not a second owner.
- Sign-out removes the Xiatian account provider and its guest grant only. It
  must not remove unrelated provider rules or reset their model choices.

## Import

Claude, Codex, ZCode and DeepSeek Harness imports are local, explicit actions.
The desktop main process owns source discovery and parsing; the renderer sends
only canonical source IDs and never supplies a filesystem path. The current
host contract is `session-import` with `detect` and `import` operations. Each
source adapter reads its authoritative local store (Claude/Codex rollout JSONL,
ZCode SQLite, or DeepSeek Harness session JSONL/JSONL.zstd), normalizes visible
user/assistant text, and records unsupported tool/artifact events as skipped
history. The host persists a versioned, namespaced ledger keyed by
`source:sourceSessionId`, and returns the same target ID on a repeated import.
Imported records are inert/read-only projections: import never replays tool
calls, executes commands, uploads transcripts or changes the original sessions.
Running source sessions are skipped rather than marked completed, and a source
record is never allowed to overwrite an existing XBuild session.

## Acceptance

1. Device start → browser consent → scoped token exchange; expiry, replay,
   wrong-account, denied consent and revoked token paths.
2. Profile/quota/keys/usage refresh with malformed and unauthorized responses;
   full keys never appear in logs or persisted renderer state.
3. Guest denied by default; paid model, group override, alternate protocol,
   oversized request, replayed/expired grant and budget exhaustion rejected.
4. Guest free-model request and normal account request reach real providers
   with correct group/model; third-party provider selection remains functional.
   The account's model requests authenticate with a server-issued session key,
   and signing out revokes it.
5. Desktop Projects, Artifacts, Routines and Customize layouts at supported
   sizes, actual navigation/actions, and no stale brand strings.
6. Import fixture per source, duplicate import, invalid input, unsupported item,
   running source and no tool re-execution. Browser/Electron acceptance, not
   retired App business unit tests.
7. Server focused Go tests plus real SQLite/MySQL/PostgreSQL migration tests;
   XBuild `pnpm typecheck`, `pnpm lint`, architecture and affected engineering
   checks. Do not deploy until these checks and a staged API test pass.
