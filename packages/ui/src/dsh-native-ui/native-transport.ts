import type {
  DshAttachment,
  DshClientMode,
  DshClientRequest,
  DshDispatch,
  DshEvent,
  DshJson,
  DshResult,
  DshScope,
} from "@zcode/shared/dsh-compat";

export type DshEventUnsubscribe = (() => void) | { dispose(): void };

/** Only the CLI controller owns accepted work, Session queues and native approvals. */
export interface DshNativeTransport {
  readonly scope: DshScope;
  readonly attachment: DshAttachment;
  readonly clientGraph: DshJson;
  readonly nativeUi: boolean;
  readonly runtimeVersion: string;
  invoke(request: DshClientRequest, options?: { signal?: AbortSignal }): Promise<DshJson>;
  cancel(callId: string): Promise<void>;
  answer(hostRequestId: string, result: DshJson): Promise<void>;
  subscribe(listener: (event: DshEvent) => void): () => void;
  detach(): Promise<void>;
}

export interface DshNativeTransportService {
  dispatch(params: DshDispatch): Promise<DshResult>;
  onDynamicDshEvent(params: {
    scope: DshScope;
    attachment?: DshAttachment;
  }): (listener: (event: DshEvent) => void) => DshEventUnsubscribe;
}

export async function attachDshNativeTransport({
  service,
  scope,
  domainId,
  attachmentId,
  clientMode = "desktop-continuous",
}: {
  service: DshNativeTransportService;
  scope: DshScope;
  domainId: string;
  attachmentId: string;
  clientMode?: DshClientMode;
}): Promise<DshNativeTransport> {
  const response = await service.dispatch({
    scope,
    command: { kind: "attach", domainId, attachmentId, clientMode },
  });
  const attached = response.value as {
    attachment: DshAttachment;
    clientGraph: DshJson;
    nativeUi: boolean;
    runtimeVersion: string;
  };
  const attachment = attached.attachment;
  let active = true;
  const listeners = new Set<(event: DshEvent) => void>();
  const subscription = service.onDynamicDshEvent({ scope, attachment });
  const unsubscribe = subscription((event) => {
    if (!active) return;
    for (const listener of listeners) listener(event);
  });
  const ensureActive = () => {
    if (!active) throw new Error("Native UI attachment is closed");
  };
  let sequence = 0;
  return {
    scope,
    attachment,
    clientGraph: attached.clientGraph,
    nativeUi: attached.nativeUi,
    runtimeVersion: attached.runtimeVersion,
    async invoke(request, options = {}) {
      ensureActive();
      // Each invocation owns an independent approval answerer and cancellation identity.
      const callId = `native-ui-${globalThis.crypto.randomUUID()}`;
      const result = await service.dispatch({
        scope,
        command: { kind: "invoke", attachment, callId, request },
        traceId: `native-ui-${++sequence}`,
      });
      options.signal?.throwIfAborted();
      return result.value;
    },
    async cancel(callId) {
      ensureActive();
      await service.dispatch({ scope, command: { kind: "cancel", attachment, callId } });
    },
    async answer(hostRequestId, result) {
      ensureActive();
      await service.dispatch({
        scope,
        command: { kind: "answer", attachment, hostRequestId, result },
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async detach() {
      if (!active) return;
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
      else unsubscribe.dispose();
      listeners.clear();
      await service.dispatch({ scope, command: { kind: "detach", attachment } });
    },
  };
}

export interface DshFetchMetadata {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyBase64?: string;
  streamId?: string;
}

export function asFetchMetadata(value: DshJson): DshFetchMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid native fetch response");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.status !== "number" ||
    typeof row.statusText !== "string" ||
    !row.headers ||
    typeof row.headers !== "object"
  ) {
    throw new Error("Invalid native fetch response metadata");
  }
  return row as unknown as DshFetchMetadata;
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

/** Ordered stream collector: preserves raw bytes and never reconstructs Session history. */
export function collectNativeStream({
  transport,
  streamId,
  signal,
  onChunk,
}: {
  transport: Pick<DshNativeTransport, "subscribe">;
  streamId: string;
  signal?: AbortSignal;
  onChunk: (bytes: Uint8Array) => void;
}): { done: Promise<void>; cancel(): void } {
  let finished = false;
  let unsubscribe: (() => void) | undefined;
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const done = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const finish = (error?: Error) => {
    if (finished) return;
    finished = true;
    unsubscribe?.();
    signal?.removeEventListener("abort", cancel);
    if (error) reject(error);
    else resolve();
  };
  const cancel = () => finish(new Error("Native stream cancelled"));
  unsubscribe = transport.subscribe((event) => {
    if (event.kind !== "stream") return;
    const payload = event.payload as {
      streamId?: string;
      event?: string;
      chunkBase64?: string;
      error?: string;
    };
    if (payload.streamId !== streamId) return;
    if (payload.event === "chunk" && typeof payload.chunkBase64 === "string") {
      onChunk(decodeBase64(payload.chunkBase64));
    } else if (payload.event === "end") {
      finish();
    } else if (payload.event === "error") {
      finish(new Error(payload.error || "Native stream failed"));
    }
  });
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  return { done, cancel };
}

/** Original native Fetch response, including streamed non-UTF8 bodies. */
export async function fetchNativeBytes(
  transport: DshNativeTransport,
  path: string,
  options: {
    signal?: AbortSignal;
    method?: "GET" | "HEAD" | "POST";
    headers?: Record<string, string>;
    bodyBase64?: string;
  } = {},
): Promise<Response> {
  const { signal, ...request } = options;
  const { streamId, bodyBase64, status, statusText, headers } = asFetchMetadata(
    await transport.invoke({ kind: "fetch", path, ...request }, { signal }),
  );
  if (streamId === undefined) {
    const bytes = bodyBase64 ? decodeBase64(bodyBase64) : new Uint8Array();
    return new Response(new Blob([bytes.buffer as ArrayBuffer]), { status, statusText, headers });
  }
  const chunks: Uint8Array[] = [];
  const stream = collectNativeStream({
    transport,
    streamId,
    signal,
    onChunk: (chunk) => chunks.push(chunk),
  });
  await stream.done;
  return new Response(new Blob(chunks as BlobPart[]), { status, statusText, headers });
}
