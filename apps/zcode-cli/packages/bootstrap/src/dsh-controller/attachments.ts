import { randomBytes, randomUUID } from "node:crypto";
import type { DshDomain, DshDomainEvent, DshInvocation } from "@zcode/dsh-runtime";
import {
  dshAttachResultSchema, dshEventSchema, dshReplaySchema, DSH_LIMITS,
  type DshAttachment, type DshAttachResult, type DshClientMode, type DshClientRequest,
  type DshEvent, type DshJson, type DshPendingQuestion, type DshReplay, type DshScope,
} from "@zcode/shared/dsh-compat";
import { DshControllerError, diagnostic, sameScope } from "./projection.js";

interface Call {
  invocation: DshInvocation;
  streamId?: string;
}
interface Question {
  value: DshPendingQuestion;
  resolve(result: DshJson): void;
  reject(error: Error): void;
}
interface Lease {
  attachment: DshAttachment;
  scope: DshScope;
  peerId: string;
  native: DshDomain;
  nativeUi: boolean;
  clientMode: DshClientMode;
  calls: Map<string, Call>;
  questions: Map<string, Question>;
  events: DshEvent[];
  sequence: number;
  eventBytes: number;
  accepting: boolean;
  close?: Promise<void>;
}
const CALL_LIMIT = 1024;

/** Transport leases only; accepted inputs and native approvals stay in the worker. */
export class DshAttachments {
  private readonly leases = new Map<string, Lease>();

  constructor(private readonly emit: (event: DshEvent) => void) {}

  private key(attachment: Pick<DshAttachment, "domainId" | "attachmentId">): string {
    return `${attachment.domainId}\0${attachment.attachmentId}`;
  }

  async attach(native: DshDomain, scope: DshScope, id: string, mode: DshClientMode, nativeUi: boolean): Promise<DshAttachResult> {
    const info = native.info;
    const attachment: DshAttachment = {
      attachmentId: id, token: randomBytes(32).toString("base64url"),
      domainId: info.domainId, generation: info.generation, revision: info.revision,
    };
    if (this.leases.has(this.key(attachment))) throw new DshControllerError("DSH_ATTACHMENT_CONFLICT", "Attachment already exists");
    const lease: Lease = {
      attachment, scope: { ...scope }, peerId: `peer-${randomUUID()}`, native, nativeUi, clientMode: mode,
      calls: new Map(), questions: new Map(), events: [], sequence: 0, eventBytes: 0, accepting: true,
    };
    this.leases.set(this.key(attachment), lease);
    try {
      await native.request({ kind: "peer-open", peerId: lease.peerId, interactions: "answer" });
      const clientGraph = await native.request({ kind: "client-graph" });
      return dshAttachResultSchema.parse({ attachment, clientGraph, nativeUi, runtimeVersion: info.runtimeVersion });
    } catch (error) {
      this.leases.delete(this.key(attachment));
      await native.request({ kind: "peer-close", peerId: lease.peerId }).catch(() => {});
      throw error;
    }
  }

  private require(attachment: DshAttachment, scope: DshScope): Lease {
    const lease = this.leases.get(this.key(attachment));
    if (!lease || !lease.accepting || lease.attachment.token !== attachment.token
      || lease.attachment.generation !== attachment.generation || lease.attachment.revision !== attachment.revision
      || !sameScope(lease.scope, scope) || lease.native.info.state !== "running") {
      throw new DshControllerError("DSH_ATTACHMENT_STALE", "Attachment is revoked, stale or outside this scope");
    }
    return lease;
  }

  async invoke(attachment: DshAttachment, scope: DshScope, callId: string, request: DshClientRequest, signal?: AbortSignal): Promise<DshJson> {
    const lease = this.require(attachment, scope);
    if (lease.calls.has(callId)) throw new DshControllerError("DSH_CALL_CONFLICT", "Call identity already exists");
    if (lease.calls.size >= CALL_LIMIT) throw new DshControllerError("DSH_CALL_LIMIT", "Attachment has too many unsettled calls");
    // worker 按 URL pathname 路由；原始前缀会被 .. 和编码点段绕过。只规范化授权分类，不改原始载荷。
    if (request.kind === "fetch" && new URL(request.path, "http://dsh.domain.local").pathname.startsWith("/plugins/") && !lease.nativeUi) {
      throw new DshControllerError("DSH_UI_NOT_AUTHORIZED", "Native UI code has not been authorized");
    }
    let nativeRequest;
    if (request.kind === "remote-stream") {
      nativeRequest = { ...request, peerId: lease.peerId, streamId: `stream-${randomUUID()}` } as const;
    } else if (request.kind === "stream-uplink") {
      if (![...lease.calls.values()].some((call) => call.streamId === request.streamId)) {
        throw new DshControllerError("DSH_STREAM_UNKNOWN", "Stream does not belong to this attachment");
      }
      nativeRequest = { ...request, peerId: lease.peerId } as const;
    } else if (request.kind === "fetch") {
      nativeRequest = { ...request, peerId: lease.peerId } as const;
    } else nativeRequest = request;
    const invocation = lease.native.invoke(nativeRequest, {
      signal,
      onHostRequest: (method, params, context) => this.ask(lease, callId, method, params, context.signal),
    });
    const call: Call = { invocation };
    if (nativeRequest.kind === "remote-stream") call.streamId = nativeRequest.streamId;
    lease.calls.set(callId, call);
    void invocation.settled.then(() => {
      this.publish(lease, "call-settled", { callId });
    }, (error) => {
      this.publish(lease, "call-settled", { callId, error: diagnostic(error) });
    }).finally(() => {
      if (lease.calls.get(callId) === call) lease.calls.delete(callId);
    });
    const result = await invocation.result;
    if (result !== null && typeof result === "object" && !Array.isArray(result) && typeof result.streamId === "string") call.streamId = result.streamId;
    return result;
  }

  cancel(attachment: DshAttachment, scope: DshScope, callId: string): boolean {
    const lease = this.require(attachment, scope);
    const call = lease.calls.get(callId);
    call?.invocation.cancel();
    return call !== undefined;
  }

  answer(attachment: DshAttachment, scope: DshScope, id: string, result: DshJson): void {
    const lease = this.require(attachment, scope);
    const pending = lease.questions.get(id);
    if (!pending) throw new DshControllerError("DSH_QUESTION_STALE", "Question is cancelled, settled or belongs to another attachment");
    lease.questions.delete(id);
    pending.resolve(result);
  }

  private ask(lease: Lease, callId: string, method: string, params: DshJson, signal: AbortSignal): Promise<DshJson> {
    if (!lease.accepting || signal.aborted) return Promise.reject(new DshControllerError("DSH_CALL_CANCELLED", "Native question was cancelled"));
    const hostRequestId = `question-${randomUUID()}`;
    const deferred = Promise.withResolvers<DshJson>();
    const value: DshPendingQuestion = { hostRequestId, callId, method, params };
    const cancelled = () => {
      if (!lease.questions.delete(hostRequestId)) return;
      deferred.reject(new DshControllerError("DSH_CALL_CANCELLED", "Native question was cancelled"));
      this.publish(lease, "host-request-cancelled", { hostRequestId, callId });
    };
    lease.questions.set(hostRequestId, { value, resolve: deferred.resolve, reject: deferred.reject });
    signal.addEventListener("abort", cancelled, { once: true });
    this.publish(lease, "host-request", value);
    return deferred.promise.finally(() => {
      signal.removeEventListener("abort", cancelled);
      lease.questions.delete(hostRequestId);
    });
  }

  replay(attachment: DshAttachment, scope: DshScope, afterSequence: number): DshReplay {
    const lease = this.require(attachment, scope);
    const first = lease.events[0]?.sequence ?? lease.sequence + 1;
    return dshReplaySchema.parse({
      events: lease.events.filter((event) => event.sequence > afterSequence),
      nextSequence: lease.sequence,
      gap: afterSequence > lease.sequence || afterSequence < first - 1,
      questions: [...lease.questions.values()].map((question) => question.value),
    });
  }

  onNativeEvent(native: DshDomain, event: DshDomainEvent): void {
    for (const lease of this.leases.values()) {
      if (lease.native !== native || !lease.accepting) continue;
      if (event.kind === "notification") this.publish(lease, "notification", event.payload);
      if (event.kind !== "stream") continue;
      const payload = event.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
      const ownsPeer = payload.peerId === lease.peerId;
      const ownsStream = [...lease.calls.values()].some((call) => call.streamId === payload.streamId);
      if (ownsPeer || ownsStream) this.publish(lease, "stream", payload);
    }
  }

  private publish(lease: Lease, kind: DshEvent["kind"], payload: DshJson): void {
    if (!lease.accepting) return;
    // 设置成 undefined 仍是 strict schema 的未知字段；凭据必须从通知信封中真正排除。
    const { attachmentId, domainId, revision, generation } = lease.attachment;
    const event = dshEventSchema.parse({
      scope: lease.scope, attachmentId, domainId, revision, generation,
      sequence: ++lease.sequence, kind, payload,
    });
    lease.events.push(event);
    lease.eventBytes += Buffer.byteLength(JSON.stringify(event));
    while (lease.events.length > DSH_LIMITS.replayEvents || lease.eventBytes > DSH_LIMITS.replayBytes) {
      lease.eventBytes -= Buffer.byteLength(JSON.stringify(lease.events.shift()!));
    }
    this.emit(event);
  }

  detach(attachment: DshAttachment, scope: DshScope): Promise<void> {
    return this.close(this.require(attachment, scope));
  }

  revokeDomain(native: DshDomain): () => Promise<void> {
    const leases = [...this.leases.values()].filter((lease) => lease.native === native);
    for (const lease of leases) this.revoke(lease);
    return async () => {
      for (const lease of leases) {
        await Promise.allSettled([
          ...[...lease.calls.values()].map((call) => call.invocation.settled),
          ...(lease.close ? [lease.close] : []),
        ]);
        if (this.leases.get(this.key(lease.attachment)) === lease) this.leases.delete(this.key(lease.attachment));
      }
    };
  }

  private revoke(lease: Lease): void {
    lease.accepting = false;
    for (const call of lease.calls.values()) call.invocation.cancel();
    for (const question of lease.questions.values()) question.reject(new DshControllerError("DSH_ATTACHMENT_STALE", "Attachment detached"));
    lease.questions.clear();
  }

  private close(lease: Lease): Promise<void> {
    if (lease.close) return lease.close;
    this.revoke(lease);
    lease.close = (async () => {
      try {
        await lease.native.request({ kind: "peer-close", peerId: lease.peerId });
        await Promise.allSettled([...lease.calls.values()].map((call) => call.invocation.settled));
      } finally {
        if (this.leases.get(this.key(lease.attachment)) === lease) this.leases.delete(this.key(lease.attachment));
      }
    })();
    return lease.close;
  }
}
