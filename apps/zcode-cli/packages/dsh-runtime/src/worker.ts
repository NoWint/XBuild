import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { installFailLoud } from '@deepseek-ai/dsh-app-boot';
import type { JsonRpcTransportPeer } from '@deepseek-ai/dsh-sdk-protocol';
import type { DshJson } from './contract.js';
import { NativeRuntime } from './native-runtime.js';
import {
  childMessageSchema, DshDomainError, jsonValue, parentMessageSchema, parseFrame,
  PROTOCOL_VERSION, STREAM_CHUNK_BYTES, wireError,
  type ChildMessage, type ParentMessage, type WorkerOptions,
} from './ipc.js';

interface ActiveRequest { controller: AbortController; task: Promise<void> }
interface HostRequest {
  resolve(result: DshJson): void;
  reject(error: Error): void;
  release(): void;
}

function completion<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Entry for the built Node worker or the CLI's explicitly selected embedded worker. */
export async function runDshDomainWorker(): Promise<void> {
  if (!process.send || !process.connected) throw new DshDomainError('DSH_DOMAIN_PROTOCOL_ERROR', 'DSH worker requires an independent Node IPC channel');
  const lifetime = completion<void>();
  const invocation = new AsyncLocalStorage<number>();
  const requests = new Map<number, ActiveRequest>();
  const hostRequests = new Map<number, HostRequest>();
  let options: WorkerOptions | undefined;
  let runtime: NativeRuntime | undefined;
  let startup: Promise<void> | undefined;
  let shutdown: Promise<void> | undefined;
  let eventSequence = 0;
  let hostSequence = 0;
  let lastRequestId = 0;
  let closing = false;
  let terminalError: Error | undefined;
  const envelope = () => ({ protocolVersion: PROTOCOL_VERSION, domainId: options!.domainId, generation: options!.generation } as const);

  const send = async (message: ChildMessage): Promise<void> => {
    if (!parseFrame(childMessageSchema, message)) throw new DshDomainError('DSH_DOMAIN_PROTOCOL_ERROR', 'Worker produced an invalid or oversized IPC frame');
    if (!process.connected) throw new DshDomainError('DSH_DOMAIN_EXITED', 'Domain owner disconnected');
    await new Promise<void>((resolve, reject) => { process.send!(message, error => { if (error) reject(error); else resolve(); }); });
  };
  const event = (kind: 'notification' | 'stream', payload: DshJson): Promise<void> =>
    send({ ...envelope(), type: 'event', eventSeq: ++eventSequence, kind, payload });

  const transport: JsonRpcTransportPeer = {
    async request(method, params, signal) {
      if (closing || signal?.aborted) throw new DshDomainError('DSH_DOMAIN_CANCELLED', 'Host interaction cancelled');
      const requestId = invocation.getStore();
      if (requestId === undefined) throw new DshDomainError('DSH_DOMAIN_PROTOCOL_ERROR', 'Host interaction has no admitted SDK invocation');
      const hostRequestId = ++hostSequence;
      const result = completion<DshJson>();
      const cancel = () => {
        hostRequests.delete(hostRequestId);
        result.reject(new DshDomainError('DSH_DOMAIN_CANCELLED', 'Host interaction cancelled'));
        void send({ ...envelope(), type: 'host-cancel', hostRequestId }).catch(() => {});
      };
      const release = () => signal?.removeEventListener('abort', cancel);
      hostRequests.set(hostRequestId, { resolve: result.resolve, reject: result.reject, release });
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        await send({ ...envelope(), type: 'host-request', requestId, hostRequestId, method, params: jsonValue(params) });
        return await result.promise;
      } finally { release(); hostRequests.delete(hostRequestId); }
    },
    notify(method, params) {
      if (closing) return;
      void event('notification', jsonValue({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) })).catch(error => { void fail(error); });
    },
  };

  const dispose = (): Promise<void> => {
    shutdown ??= (async () => {
      closing = true;
      for (const request of requests.values()) request.controller.abort();
      runtime?.cancelAll();
      for (const pending of hostRequests.values()) { pending.release(); pending.reject(new DshDomainError('DSH_DOMAIN_STOPPED', 'Domain is stopping')); }
      hostRequests.clear();
      // boot 和原生请求都必须真实结算；仅 supervisor 的 liveness budget 可以终止失联进程。
      await startup?.catch(() => {});
      await Promise.allSettled([...requests.values()].map(request => request.task));
      await runtime?.close();
      invocation.disable();
    })();
    return shutdown;
  };

  const fail = async (error: unknown): Promise<void> => {
    let cleanupComplete = true;
    try { await dispose(); }
    catch (cleanupError) { cleanupComplete = false; error = new AggregateError([error, cleanupError], 'Domain startup or request failure and cleanup failed'); }
    terminalError = error instanceof Error ? error : new Error(String(error));
    if (options && process.connected) {
      try { await send({ ...envelope(), type: 'failed', error: wireError(error, 'DSH_DOMAIN_STARTUP_FAILED'), cleanupComplete }); return; }
      catch { /* The disconnected parent owns the remaining exit failure. */ }
    }
    lifetime.reject(terminalError);
  };

  const execute = async (message: Extract<ParentMessage, { type: 'request' }>, controller: AbortController): Promise<void> => {
    const signal = controller.signal;
    const request = message.request;
    let continuation: Promise<void> | undefined;
    try {
      signal.throwIfAborted();
      let result: DshJson;
      if (request.kind === 'sdk') result = await runtime!.sdkRequest(request.method, request.params, signal, completion => { continuation = completion; });
      else if (request.kind === 'plugins') result = runtime!.plugins();
      else if (request.kind === 'client-graph') result = runtime!.graph();
      else if (request.kind === 'peer-open') result = runtime!.openPeer(request.peerId, request.interactions);
      else if (request.kind === 'peer-close') result = await runtime!.closePeer(request.peerId);
      else if (request.kind === 'stream-uplink') result = runtime!.uplink(request);
      else if (request.kind === 'remote-stream') {
        const metadata = { peerId: request.peerId, streamId: request.streamId };
        let close: (() => Promise<void>) | undefined;
        try {
          const stream = await runtime!.openRemoteStream(request, signal);
          close = stream.close;
          // 注册与回执先于首次 next()；完整 native iterator 是这个 invocation 的结算边界。
          await send({ ...envelope(), type: 'result', requestId: message.requestId, result: metadata });
          for await (const value of stream.values) {
            await event('stream', { ...metadata, event: 'data', ...(value === undefined ? {} : { value: jsonValue(value) }) });
          }
          await event('stream', { ...metadata, event: 'end' });
        } catch (error) {
          // admission 尚未成功时只拒绝新 request；同 Peer 的旧 stream 不能收到伪造终态。
          if (!close) throw error;
          await event('stream', { ...metadata, event: 'error', error: runtime!.remoteFailure(error) });
        } finally { await close?.(); }
        return;
      }
      else {
        const response = await runtime!.fetch(request, signal);
        const headers: Record<string, string> = {};
        response.headers.forEach((value, name) => { headers[name] = value; });
        const metadata = { status: response.status, statusText: response.statusText, headers };
        if (!response.body) result = { ...metadata, bodyBase64: '' };
        else {
          const streamId = randomUUID();
          const reader = response.body.getReader();
          const cancel = () => { void reader.cancel(signal.reason).catch(() => {}); };
          signal.addEventListener('abort', cancel, { once: true });
          try {
            // header ack 先入 IPC，再读取 stream；父方可按同一 request 注册 streamId，不丢首 chunk。
            await send({ ...envelope(), type: 'result', requestId: message.requestId, result: { ...metadata, streamId } });
            while (true) {
              signal.throwIfAborted();
              const next = await reader.read();
              signal.throwIfAborted();
              if (next.done) break;
              for (let offset = 0; offset < next.value.byteLength; offset += STREAM_CHUNK_BYTES) {
                const bytes = next.value.subarray(offset, offset + STREAM_CHUNK_BYTES);
                await event('stream', { streamId, event: 'chunk', chunkBase64: Buffer.from(bytes).toString('base64') });
              }
            }
            await event('stream', { streamId, event: 'end' });
          } catch (error) {
            await reader.cancel(error).catch(() => {});
            await event('stream', { streamId, event: 'error', error: error instanceof Error ? error.message : String(error) });
          } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
          return;
        }
      }
      await send({ ...envelope(), type: 'result', requestId: message.requestId, result });
      await continuation;
    } catch (error) {
      await send({ ...envelope(), type: 'error', requestId: message.requestId, error: wireError(error, signal.aborted ? 'DSH_DOMAIN_CANCELLED' : 'DSH_DOMAIN_REQUEST_FAILED') });
      await continuation?.catch(() => {});
    } finally {
      requests.delete(message.requestId);
      if (process.connected) await send({ ...envelope(), type: 'settled', requestId: message.requestId });
    }
  };

  const receive = (value: unknown): void => {
    const message = parseFrame(parentMessageSchema, value);
    if (!message) return;
    if (message.type === 'init') {
      if (options || message.options.domainId !== message.domainId || message.options.generation !== message.generation) return;
      options = message.options;
      runtime = new NativeRuntime(options, transport);
      startup = runtime.start();
      void startup.then(async () => { if (!closing) await send({ ...envelope(), type: 'ready', runtimeVersion: runtime!.runtimeVersion }); }).catch(error => { void fail(error); });
      return;
    }
    if (!options || message.domainId !== options.domainId || message.generation !== options.generation) return;
    switch (message.type) {
      case 'request': {
        if (closing || !runtime || !startup || message.requestId <= lastRequestId) return;
        lastRequestId = message.requestId;
        const controller = new AbortController();
        const task = invocation.run(message.requestId, async () => { await startup; await execute(message, controller); });
        requests.set(message.requestId, { controller, task });
        void task.catch(error => { void fail(error); });
        return;
      }
      case 'cancel':
        requests.get(message.requestId)?.controller.abort(new DshDomainError('DSH_DOMAIN_CANCELLED', 'Owner cancelled domain request')); return;
      case 'stop':
        if (closing) return;
        // 保留 worker 父身份直到 supervisor 完成实际资源观测；IPC 回执不是资源释放证明。
        void dispose().then(async () => { await send({ ...envelope(), type: 'stopped' }); }).catch(error => { void fail(error); });
        return;
      case 'exit':
        if (!closing || !shutdown) return;
        if (terminalError) lifetime.reject(terminalError);
        else lifetime.resolve();
        return;
      case 'host-result': case 'host-error': {
        const pending = hostRequests.get(message.hostRequestId);
        if (!pending) return;
        hostRequests.delete(message.hostRequestId);
        pending.release();
        if (message.type === 'host-result') pending.resolve(message.result);
        else pending.reject(new DshDomainError('DSH_DOMAIN_REQUEST_FAILED', message.error.message));
        return;
      }
    }
  };
  const disconnected = () => { void dispose().then(() => lifetime.reject(new DshDomainError('DSH_DOMAIN_EXITED', 'Domain owner disconnected')), error => lifetime.reject(error)); };
  const interrupted = () => { void dispose().then(() => lifetime.reject(new DshDomainError('DSH_DOMAIN_EXITED', 'Worker interrupted')), error => lifetime.reject(error)); };
  const uninstallFatal = installFailLoud('zcode-dsh-domain', process, dispose);
  process.on('message', receive);
  process.once('disconnect', disconnected);
  process.once('SIGTERM', interrupted);
  process.once('SIGINT', interrupted);
  try { await lifetime.promise; }
  finally {
    uninstallFatal();
    process.off('message', receive);
    process.off('disconnect', disconnected);
    process.off('SIGTERM', interrupted);
    process.off('SIGINT', interrupted);
  }
}
