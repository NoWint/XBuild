import assert from "node:assert/strict";
import { MessageChannel } from "node:worker_threads";
import {
  ChannelClient,
  ChannelServer,
  Emitter,
  MessagePortProtocol,
  ProxyChannel,
} from "../../packages/rpc/src/index.ts";
import * as dshServices from "../../packages/services/src/dsh-plugins/index.ts";
import { ZCodeProtocolClient } from "../../packages/services/src/zcode-agent/zcodeProtocolClient.ts";
import {
  SourceServerWorkspaceIdentityChannelServer,
  SourceServerWorkspaceIdentityMapper,
} from "../../packages/services/src/source-server-workspace/sourceServerWorkspaceIdentityChannelServer.ts";
import { dshDispatchSchema, dshResultSchema } from "../../packages/shared/src/dsh-compat/index.ts";

// Regressions: forwarding caller mode, foreign tokens, cwd-only routing, recursive native JSON
// rewriting, late attach leaks, swallowed unsupported errors, or a fixed native SDK deadline.
assert.equal(
  typeof dshServices.createDshPluginService,
  "function",
  "DSH routing service must exist",
);
assert.equal(
  typeof dshServices.createDshPluginConnectionScope,
  "function",
  "DSH connection facade must exist",
);

const scopeA = {
  workspacePath: "/same-path",
  workspaceIdentity: "stable-a",
  remoteSessionId: "remote-a",
};
const scopeB = {
  workspacePath: "/same-path",
  workspaceIdentity: "stable-b",
  remoteSessionId: "remote-b",
};
const nativeJson = {
  workspaceIdentity: "canonical-a",
  text: "stable-a",
  nested: ["canonical-a", { workspacePath: "stable-a" }],
};
const notes = new Emitter();
const incoming = new Emitter();
const close = new Emitter();
const leases = new Map();
const detached = [];
const seen = [];
let serial = 0;
let lateResponse;
let lateReceived;
const lateReady = new Promise((resolve) => {
  lateReceived = resolve;
});
const protocol = new ZCodeProtocolClient(
  {
    kind: "deterministic-protocol-peer",
    onMessage: incoming.event,
    onClose: close.event,
    dispose() {},
    async send(frame) {
      const params = dshDispatchSchema.parse(frame.params);
      seen.push(params);
      const command = params.command;
      let value = nativeJson;
      if (command.kind === "overview") {
        value = {
          catalogs: [],
          runtimeVersions: { native: "canonical-a" },
          domains: [
            {
              domainId: "domain",
              scope: params.scope,
              enabled: false,
              revisions: [],
              state: "stopped",
              generation: 0,
              compatibility: "unverified",
              diagnostics: [{ code: "diagnostic", message: "canonical-a" }],
            },
          ],
        };
      } else if (command.kind === "attach") {
        const attachment = {
          attachmentId: command.attachmentId,
          token: `token-for-lease-${++serial}`,
          domainId: command.domainId,
          generation: 1,
          revision: "revision-1",
        };
        leases.set(attachment.token, { scope: params.scope, attachment });
        value = {
          attachment,
          clientGraph: nativeJson,
          nativeUi: false,
          runtimeVersion: "acceptance",
        };
        if (command.attachmentId.endsWith(":late")) {
          lateResponse = () => incoming.fire({ id: frame.id, result: { value } });
          lateReceived();
          return;
        }
      } else if (command.kind === "detach") {
        detached.push(command.attachment.token);
        leases.delete(command.attachment.token);
        value = { detached: true, nativeJson };
      } else if (command.kind === "events") {
        value = {
          events: [
            {
              scope: params.scope,
              domainId: command.attachment.domainId,
              revision: "revision-1",
              generation: 1,
              attachmentId: command.attachment.attachmentId,
              sequence: 1,
              kind: "notification",
              payload: nativeJson,
            },
          ],
          nextSequence: 1,
          gap: false,
        };
      }
      if (command.kind === "invoke" && command.callId === "unsupported") {
        incoming.fire({
          id: frame.id,
          error: { code: -32601, message: "Method not found: plugins/dsh/dispatch" },
        });
        return;
      }
      if (command.kind === "invoke" && command.callId === "wait") {
        setTimeout(() => incoming.fire({ id: frame.id, result: { value } }), 30);
        return;
      }
      incoming.fire({ id: frame.id, result: { value } });
    },
  },
  { requestTimeoutMs: 5 },
);
const agent = {
  dispatchDshPlugin: (params) =>
    protocol.request("plugins/dsh/dispatch", params, dshResultSchema, { timeoutMs: null }),
  onDynamicDshPluginEvent: () => notes.event,
};
const base = dshServices.createDshPluginService({ zcodeAgentService: agent });
const mapper = new SourceServerWorkspaceIdentityMapper();
mapper.register({ stableIdentity: "stable-a", canonicalIdentity: "canonical-a" });
mapper.register({ stableIdentity: "stable-b", canonicalIdentity: "canonical-b" });
const handles = [];
const facades = [];
function connect(mode, options = {}) {
  const facade = dshServices.createDshPluginConnectionScope(
    options.base ?? base,
    {
      clientMode: mode,
      connectionId: `connection-${facades.length}`,
      role: options.role,
    },
    options.expectedScope,
  );
  facades.push(facade);
  const { port1, port2 } = new MessageChannel();
  const clientProtocol = new MessagePortProtocol(port1);
  const serverProtocol = new MessagePortProtocol(port2);
  const client = new ChannelClient(clientProtocol);
  const raw = new ChannelServer(serverProtocol, "acceptance");
  const server =
    options.mapIdentity === false
      ? raw
      : new SourceServerWorkspaceIdentityChannelServer(raw, mapper);
  server.registerChannel(
    dshServices.IDshPluginService.channelName,
    ProxyChannel.fromService(facade.service),
  );
  handles.push(() => {
    raw.dispose();
    client.dispose();
    clientProtocol.disconnect();
    serverProtocol.disconnect();
  });
  return ProxyChannel.toService(client.getChannel(dshServices.IDshPluginService.channelName));
}
try {
  const desktop = connect("desktop-continuous");
  const phone = connect("web-remote-replayable");
  const attach = (service, scope, attachmentId) =>
    service
      .dispatch({
        scope,
        command: {
          kind: "attach",
          domainId: "domain",
          attachmentId,
          clientMode: "desktop-continuous",
        },
      })
      .then(({ value }) => value);
  const first = await attach(desktop, scopeA, "desktop");
  const second = await attach(phone, scopeB, "phone");
  assert.equal(
    seen[1].command.clientMode,
    "web-remote-replayable",
    "trusted phone mode replaces requested desktop mode",
  );
  assert.equal(seen[0].scope.workspaceIdentity, "canonical-a");
  assert.equal(
    seen[1].scope.workspaceIdentity,
    "canonical-b",
    "same cwd must not collapse identity",
  );
  assert.deepEqual(
    first.clientGraph,
    nativeJson,
    "native client graph must not be identity-rewritten",
  );
  const invoke = {
    kind: "invoke",
    attachment: first.attachment,
    callId: "roundtrip",
    request: { kind: "sdk", method: "example", params: nativeJson },
  };
  assert.deepEqual(await desktop.dispatch({ scope: scopeA, command: invoke }), {
    value: nativeJson,
  });
  assert.deepEqual(
    seen[2].command.request.params,
    nativeJson,
    "native request must not be identity-rewritten",
  );
  for (const command of [
    invoke,
    { kind: "cancel", attachment: first.attachment, callId: "x" },
    { kind: "answer", attachment: first.attachment, hostRequestId: "x", result: null },
    { kind: "events", attachment: first.attachment, afterSequence: 0 },
    { kind: "detach", attachment: first.attachment },
  ]) {
    await assert.rejects(phone.dispatch({ scope: scopeA, command }), /notOwned/);
  }
  await assert.rejects(desktop.dispatch({ scope: scopeB, command: invoke }), /notOwned/);
  await assert.rejects(
    desktop.dispatch({
      scope: scopeA,
      command: { ...invoke, attachment: { ...first.attachment, generation: 2 } },
    }),
    /notOwned/,
  );
  await assert.rejects(
    desktop.dispatch({
      scope: scopeA,
      command: { ...invoke, attachment: { ...first.attachment, token: "a-foreign-token-12345" } },
    }),
    /notOwned/,
  );
  assert.throws(
    () => facades[1].service.onDynamicDshEvent({ scope: scopeA, attachment: first.attachment }),
    /notOwned/,
  );
  const replay = await desktop.dispatch({
    scope: scopeA,
    command: { kind: "events", attachment: first.attachment, afterSequence: 0 },
  });
  assert.equal(replay.value.events[0].scope.workspaceIdentity, "stable-a");
  assert.deepEqual(replay.value.events[0].payload, nativeJson);
  const eventPromise = new Promise((resolve) => {
    const subscription = desktop.onDynamicDshEvent({ scope: scopeA, attachment: first.attachment })(
      (event) => {
        subscription.dispose();
        resolve(event);
      },
    );
  });
  // An ordinary call forms a deterministic transport barrier after EventListen, without a sleep.
  const overview = await desktop.dispatch({ scope: scopeA, command: { kind: "overview" } });
  assert.equal(overview.value.domains[0].scope.workspaceIdentity, "stable-a");
  assert.equal(overview.value.domains[0].diagnostics[0].message, "canonical-a");
  assert.equal(overview.value.runtimeVersions.native, "canonical-a");
  notes.fire({
    scope: { ...scopeA, workspaceIdentity: "canonical-a" },
    domainId: "domain",
    revision: "revision-1",
    generation: 1,
    attachmentId: first.attachment.attachmentId,
    sequence: 2,
    kind: "notification",
    payload: nativeJson,
  });
  const event = await eventPromise;
  assert.equal(event.scope.workspaceIdentity, "stable-a");
  assert.deepEqual(event.payload, nativeJson);
  await desktop.dispatch({
    scope: {
      workspaceIdentity: "stable-a",
      workspacePath: "stable-a",
      remoteSessionId: "stable-a",
    },
    command: { kind: "overview" },
  });
  assert.deepEqual(
    seen.at(-1).scope,
    {
      workspaceIdentity: "canonical-a",
      workspacePath: "stable-a",
      remoteSessionId: "stable-a",
    },
    "scope identity mapping must not rewrite cwd or remoteSessionId",
  );
  const upstream = connect("desktop-continuous", { role: "trusted-host-relay" });
  const viaHost = connect("web-remote-replayable", {
    base: upstream,
    mapIdentity: false,
    expectedScope: scopeA,
  });
  const relayed = await viaHost.dispatch({
    scope: scopeA,
    command: {
      kind: "attach",
      domainId: "domain",
      attachmentId: "relayed",
      clientMode: "desktop-continuous",
    },
    __zcodeTrustedV4Connection: { connectionId: "spoofed", clientMode: "desktop-continuous" },
  });
  assert.equal(
    seen.at(-1).command.clientMode,
    "web-remote-replayable",
    "Source relay retains trusted downstream mode, not requested carrier",
  );
  await assert.rejects(
    viaHost.dispatch({
      scope: { ...scopeA, workspacePath: "/wrong" },
      command: { kind: "overview" },
    }),
    /notOwned/,
    "remote attachment cannot substitute cwd while retaining identity",
  );
  const detachedResult = await viaHost.dispatch({
    scope: scopeA,
    command: { kind: "detach", attachment: relayed.value.attachment },
  });
  assert.deepEqual(
    detachedResult,
    { value: { detached: true, nativeJson } },
    "detach preserves the native result",
  );
  await facades[3].dispose();
  await facades[2].dispose();
  assert.deepEqual(
    await desktop.dispatch({ scope: scopeA, command: { ...invoke, callId: "wait" } }),
    { value: nativeJson },
    "native wait outlives ordinary 5ms deadline",
  );
  await assert.rejects(
    protocol.request(
      "plugins/dsh/dispatch",
      { scope: scopeA, command: { ...invoke, callId: "wait" } },
      dshResultSchema,
      { lifecycle: "observation" },
    ),
    /timed out/,
    "ordinary requests retain default deadline",
  );
  await assert.rejects(
    desktop.dispatch({ scope: scopeA, command: { ...invoke, callId: "unsupported" } }),
    /Method not found/,
  );
  const lateAttach = attach(desktop, scopeA, "late");
  await lateReady;
  const closing = facades[0].dispose();
  lateResponse();
  await assert.rejects(lateAttach, /closed/);
  await closing;
  assert.ok(detached.includes(first.attachment.token), "connection close detaches its own lease");
  assert.equal(
    detached.length,
    3,
    "relayed and late attach acknowledgements are reclaimed as well",
  );
  assert.ok(leases.has(second.attachment.token));
  await facades[1].dispose();
  assert.equal(leases.size, 0);
} finally {
  await Promise.allSettled(facades.map((facade) => facade.dispose()));
  for (const dispose of handles) dispose();
  protocol.dispose();
  notes.dispose();
  incoming.dispose();
  close.dispose();
}
console.log(
  "PASS DSH real MessagePort service routing: scope, lease, mode, payload, event, replay, cleanup, unsupported, no native deadline",
);
