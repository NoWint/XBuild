import { describe, expect, it } from "vitest";
import * as protocol from "@zcode/shared/dsh-compat";

const scope = {
  workspacePath: "/workspace",
  workspaceIdentity: "ssh:example:/workspace",
  remoteSessionId: "remote-one",
};
const attachment = {
  attachmentId: "attachment-one",
  token: "opaque-owner-token",
  domainId: "domain-one",
  revision: "revision-one",
  generation: 7,
};

describe("DSH carrier boundary", () => {
  it("retains original native payload fields without converting them to ZCode events", () => {
    const native = {
      sessionId: "original-session",
      event: {
        type: "custom/plugin-event", seq: 12, time: 100,
        data: { extension: { constructor: "ordinary-json-field", values: [false, 0, null] } },
      },
    };
    const result = protocol.dshEventSchema.parse({
      scope, attachmentId: attachment.attachmentId, domainId: attachment.domainId,
      revision: attachment.revision, generation: 7, sequence: 8,
      kind: "notification", payload: native,
    });
    expect(result.payload).toEqual(native);
    expect(result.scope).toEqual(scope);
    expect(result.generation).toBe(7);
  });

  it("rejects malformed, foreign-shaped and unsafe carrier envelopes", () => {
    const invoke = {
      scope, command: { kind: "invoke", attachment, callId: "call-one", request: { kind: "sdk", method: "session/query", params: { sessionId: "native-session", contentBlocks: [] } } },
    };
    expect(protocol.dshDispatchSchema.parse(invoke)).toEqual(invoke);
    for (const value of [
      { ...invoke, trusted: true },
      { ...invoke, command: { ...invoke.command, attachment: { ...attachment, generation: 0 } } },
      { ...invoke, command: { ...invoke.command, request: { kind: "peer-close", peerId: "other-attachment" } } },
      { ...invoke, command: { ...invoke.command, request: { kind: "fetch", path: "//external.example/api" } } },
      { ...invoke, command: { ...invoke.command, request: { kind: "sdk", method: "session/query", params: { value: Infinity } } } },
    ]) expect(protocol.dshDispatchSchema.safeParse(value).success).toBe(false);
  });

  it("requires explicit native-code boundary and exact revision authorization", () => {
    const grant = {
      revision: "revision-one", digest: "a".repeat(64),
      nativeCode: true, nativeUi: false, executionMode: "trusted-process",
      filesystem: "unrestricted", network: true, subprocess: true, installationScripts: [],
    };
    expect(protocol.dshGrantSchema.parse(grant)).toEqual(grant);
    const { executionMode: _mode, ...legacy } = grant;
    expect(protocol.dshGrantSchema.safeParse(legacy).success).toBe(false);
    expect(protocol.dshGrantSchema.safeParse({ ...grant, nativeCode: false }).success).toBe(false);
    expect(protocol.dshGrantSchema.safeParse({ ...grant, digest: "wrong" }).success).toBe(false);
  });

  it("preserves stream undefined items and explicit replay gaps", () => {
    const event = {
      scope, attachmentId: attachment.attachmentId, domainId: attachment.domainId,
      revision: attachment.revision, generation: 7, sequence: 9,
      kind: "stream", payload: { peerId: "internal-peer", streamId: "native-stream", event: "data" },
    };
    const parsed = protocol.dshEventSchema.parse(event);
    expect(parsed.payload).not.toHaveProperty("value");
    expect(protocol.dshReplaySchema.parse({
      events: [event], nextSequence: 9, gap: true,
    })).toMatchObject({ nextSequence: 9, gap: true });
    expect(protocol.dshReplaySchema.safeParse({
      events: [event], nextSequence: -1, gap: false,
    }).success).toBe(false);
  });
});
