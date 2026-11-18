import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DshDomain, DshDomainEvent, DshDomainInfo, DshDomainRequest, DshDomainStartOptions, DshInvocation, DshInvocationOptions, DshJson } from './contract.js';
import {
  childMessageSchema, DshDomainError, fromWire, parseFrame, PROTOCOL_VERSION,
  requestSchema, SHUTDOWN_TIMEOUT_MS, STARTUP_TIMEOUT_MS, workerOptionsSchema,
  type ChildMessage, type ParentMessage, type WorkerOptions,
} from './ipc.js';
import { DataOwnership } from './ownership.js';
import { assertProcessLifetimePlatform, ProcessLifetime, PROCESS_VERIFICATION_MS } from './process-lifetime.js';

interface Pending {
  resolve(value: DshJson): void;
  reject(error: Error): void;
  release(): void;
  signal?: AbortSignal;
  onHostRequest?: DshDomainStartOptions['onHostRequest'];
  settled: ReturnType<typeof deferred<void>>;
}
const BLOCKED_ENVIRONMENT = /^(NODE_OPTIONS|NODE_PATH|LD_PRELOAD|LD_LIBRARY_PATH|LD_AUDIT|DYLD_.*)$/i;
const LOG_CHUNK_BYTES = 16 * 1024;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** An approved Profile is the configuration; there is no implicit default bundle. */
export async function startDshDomain(options: DshDomainStartOptions): Promise<DshDomain> {
  const { domainId, revision, generation, workspace, profileDirectory, installationAnchor, dataDirectory, environment } = options;
  const prepared = parseFrame(workerOptionsSchema, { domainId, revision, generation, workspace, profileDirectory, installationAnchor, dataDirectory, environment });
  if (prepared === undefined || [workspace.workspacePath, profileDirectory, installationAnchor, dataDirectory].some(path => !isAbsolute(path))) {
    throw new DshDomainError('DSH_DOMAIN_INVALID_OPTIONS', 'Domain identity and absolute approved paths are required');
  }
  for (const budget of [options.startupTimeoutMs, options.shutdownTimeoutMs]) {
    if (budget !== undefined && (!Number.isSafeInteger(budget) || budget <= 0)) {
      throw new DshDomainError('DSH_DOMAIN_INVALID_OPTIONS', 'Liveness bounds must be positive safe integers');
    }
  }
  assertProcessLifetimePlatform();
  const ownership = await DataOwnership.acquire(options);
  let domain: Supervisor | undefined;
  try {
    const userHome = join(dataDirectory, 'home');
    const temporary = join(dataDirectory, 'tmp');
    await Promise.all([mkdir(dataDirectory, { recursive: true }), mkdir(userHome, { recursive: true }), mkdir(temporary, { recursive: true })]);
    const env = Object.fromEntries(Object.entries(environment).filter(([key]) => !BLOCKED_ENVIRONMENT.test(key)));
    Object.assign(env, { DSH_HOME: dataDirectory, HOME: userHome, USERPROFILE: userHome, TMPDIR: temporary, TMP: temporary, TEMP: temporary });
    // 不继承父 execArgv / NODE_OPTIONS；插件的 stdout/stderr 和专用 ipc fd 必须物理分离。
    const args = options.runner?.argsPrefix ?? [fileURLToPath(new URL('./worker-entry.js', import.meta.url))];
    const child = spawn(options.runner?.executable ?? process.execPath, args, {
      cwd: workspace.workspacePath, env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], serialization: 'json', windowsHide: true, detached: true,
    });
    domain = new Supervisor(child, prepared, options, ownership);
    await domain.start();
    return domain;
  } catch (error) { if (!domain) await ownership.release(); throw error; }
}

class Supervisor implements DshDomain {
  private readonly current: DshDomainInfo;
  private readonly listeners = new Set<(event: DshDomainEvent) => void>();
  private readonly pending = new Map<number, Pending>();
  private readonly streams = new Map<number, { streamId: string; peerId?: string }>();
  private readonly hostRequests = new Map<number, AbortController>();
  private readonly ready = deferred<void>();
  private readonly exited = deferred<void>();
  private readonly envelope;
  private requestSequence = 0;
  private eventSequence = 0;
  private nativeEventSequence = 0;
  private stopTask?: Promise<void>;
  private failure?: DshDomainError;
  private cleanupConfirmed = false;
  private startupCleanupConfirmed = false;
  private didExit = false;
  private startupTimer?: ReturnType<typeof setTimeout>;
  private shutdownTimer?: ReturnType<typeof setTimeout>;
  private readonly processLifetime: ProcessLifetime;

  constructor(private readonly child: ChildProcess, private readonly options: WorkerOptions, private readonly hooks: DshDomainStartOptions, private readonly ownership: DataOwnership) {
    this.processLifetime = new ProcessLifetime(child);
    this.envelope = { protocolVersion: PROTOCOL_VERSION, domainId: options.domainId, generation: options.generation } as const;
    this.current = { domainId: options.domainId, revision: options.revision, generation: options.generation, workspace: { ...options.workspace }, state: 'starting', pid: child.pid, runtimeVersion: '' };
    child.on('message', this.onMessage);
    child.once('error', error => { this.fail(new DshDomainError('DSH_DOMAIN_STARTUP_FAILED', 'Worker process could not start', { cause: error })); });
    child.once('exit', (code, signal) => { void this.onExit(code, signal); });
    // ENOENT spawn emits close without exit.
    child.once('close', () => { if (!this.didExit) void this.onExit(null, null); });
    child.stdout?.on('data', (chunk: Buffer) => this.log('stdout', chunk));
    child.stderr?.on('data', (chunk: Buffer) => this.log('stderr', chunk));
  }

  get info(): DshDomainInfo { return { ...this.current, workspace: { ...this.current.workspace } }; }

  async start(): Promise<void> {
    this.startupTimer = setTimeout(() => this.fail(new DshDomainError('DSH_DOMAIN_STARTUP_TIMEOUT', 'Native domain startup timed out')), this.hooks.startupTimeoutMs ?? STARTUP_TIMEOUT_MS);
    this.send({ ...this.envelope, type: 'init', options: this.options });
    try { await this.ready.promise; }
    catch (error) {
      await this.processLifetime.terminate();
      await this.exited.promise;
      // 等待资源 owner 的最终结算后返回诊断；不能丢掉随后补充的 quarantine 信息。
      throw this.failure ?? error;
    } finally { clearTimeout(this.startupTimer); }
  }

  request(request: DshDomainRequest, options: DshInvocationOptions = {}): Promise<DshJson> {
    return this.invoke(request, options).result;
  }

  invoke(request: DshDomainRequest, options: DshInvocationOptions = {}): DshInvocation {
    const rejected = (error: DshDomainError): DshInvocation => {
      const result = Promise.reject<DshJson>(error);
      const settled = Promise.reject<void>(error);
      void settled.catch(() => {});
      return { result, settled, cancel() {} };
    };
    if (this.current.state !== 'running') return rejected(this.failure ?? new DshDomainError('DSH_DOMAIN_STOPPED', 'Domain is not accepting work'));
    const parsed = parseFrame(requestSchema, request);
    if (parsed === undefined) return rejected(new DshDomainError('DSH_DOMAIN_PROTOCOL_ERROR', 'Invalid domain request'));
    if (options.signal?.aborted) return rejected(new DshDomainError('DSH_DOMAIN_CANCELLED', 'Domain request was cancelled'));
    const requestId = ++this.requestSequence;
    const result = deferred<DshJson>();
    const settled = deferred<void>();
    void settled.promise.catch(() => {});
    const controller = new AbortController();
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    const cancelled = () => {
      this.send({ ...this.envelope, type: 'cancel', requestId });
      result.reject(new DshDomainError('DSH_DOMAIN_CANCELLED', 'Domain request was cancelled'));
      // 回执不撤销 invocation owner；只在 worker 原生清理后释放 signal 和审批关联。
    };
    const releaseSignal = () => signal.removeEventListener('abort', cancelled);
    const pending: Pending = { resolve: result.resolve, reject: result.reject, release: releaseSignal, signal, settled, onHostRequest: options.onHostRequest ?? this.hooks.onHostRequest };
    this.pending.set(requestId, pending);
    signal.addEventListener('abort', cancelled, { once: true });
    this.send({ ...this.envelope, type: 'request', requestId, request: parsed });
    return { result: result.promise, settled: settled.promise, cancel: () => controller.abort() };
  }

  subscribe(listener: (event: DshDomainEvent) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  stop(): Promise<void> {
    this.stopTask ??= this.performStop();
    return this.stopTask;
  }

  private async performStop(): Promise<void> {
    if (this.didExit) { await this.exited.promise; if (this.failure) throw this.failure; return; }
    this.current.state = 'stopping';
    const stopped = new DshDomainError('DSH_DOMAIN_STOPPED', 'Domain is stopping');
    for (const [requestId, pending] of this.pending) {
      this.send({ ...this.envelope, type: 'cancel', requestId });
      pending.reject(stopped);
    }
    for (const controller of this.hostRequests.values()) controller.abort(stopped);
    try { await this.processLifetime.observe(); }
    catch (error) { this.fail(new DshDomainError('DSH_DOMAIN_RESOURCE_QUARANTINED', 'Native resources could not be observed before shutdown', { cause: error })); }
    this.send({ ...this.envelope, type: 'stop' });
    const timer = setTimeout(() => {
      this.failure = new DshDomainError('DSH_DOMAIN_SHUTDOWN_TIMEOUT', 'Native cleanup did not confirm before the shutdown bound');
      void this.processLifetime.terminate();
    }, this.hooks.shutdownTimeoutMs ?? SHUTDOWN_TIMEOUT_MS);
    this.shutdownTimer = timer;
    try { await this.exited.promise; }
    finally { clearTimeout(timer); }
    if (this.failure) throw this.failure;
  }

  private onMessage = (value: unknown): void => {
    const message = parseFrame(childMessageSchema, value);
    if (!message || message.domainId !== this.options.domainId || message.generation !== this.options.generation || this.didExit) return;
    switch (message.type) {
      case 'ready':
        if (this.current.state !== 'starting') return;
        this.current.runtimeVersion = message.runtimeVersion;
        void this.processLifetime.observe().then(() => {
          if (this.current.state !== 'starting' || this.failure || this.didExit) return;
          this.current.state = 'running';
          this.ready.resolve();
        }).catch(error => { this.fail(new DshDomainError('DSH_DOMAIN_RESOURCE_QUARANTINED', 'Native process ownership could not be verified at startup', { cause: error })); });
        return;
      case 'failed':
        if (this.current.state === 'starting') this.startupCleanupConfirmed = message.cleanupComplete;
        this.fail(fromWire(message.error, this.current.state === 'starting' ? 'DSH_DOMAIN_STARTUP_FAILED' : 'DSH_DOMAIN_SHUTDOWN_FAILED'));
        return;
      case 'stopped':
        if (this.current.state === 'stopping') {
          this.cleanupConfirmed = true;
          // native disposer 已明确结算；随后等待的是平台资源观测，不再冒充 native cleanup 超时。
          clearTimeout(this.shutdownTimer);
          this.shutdownTimer = setTimeout(() => {
            this.fail(new DshDomainError('DSH_DOMAIN_RESOURCE_QUARANTINED', 'Worker exit after native cleanup could not be verified'));
          }, PROCESS_VERIFICATION_MS);
          void this.processLifetime.observe().then(() => { this.send({ ...this.envelope, type: 'exit' }); })
            .catch(error => { this.fail(new DshDomainError('DSH_DOMAIN_RESOURCE_QUARANTINED', 'Native resources could not be observed after cleanup', { cause: error })); });
        }
        return;
      case 'result': case 'error': {
        const pending = this.pending.get(message.requestId);
        if (!pending) return;
        if (message.type === 'error') { pending.reject(fromWire(message.error, 'DSH_DOMAIN_REQUEST_FAILED')); return; }
        const result = message.result;
        if (result !== null && typeof result === 'object' && !Array.isArray(result) && typeof result.streamId === 'string') {
          this.streams.set(message.requestId, { streamId: result.streamId, ...(typeof result.peerId === 'string' ? { peerId: result.peerId } : {}) });
        }
        pending.resolve(result);
        return;
      }
      case 'settled': {
        const admission = this.pending.get(message.requestId);
        if (admission) {
          admission.release();
          admission.settled.resolve();
          this.pending.delete(message.requestId);
          this.streams.delete(message.requestId);
        }
        return;
      }
      case 'event': this.onEvent(message); return;
      case 'host-request': void this.answerHost(message); return;
      case 'host-cancel': this.hostRequests.get(message.hostRequestId)?.abort(); this.hostRequests.delete(message.hostRequestId); return;
    }
  };

  private onEvent(message: Extract<ChildMessage, { type: 'event' }>): void {
    if (message.eventSeq <= this.nativeEventSequence) return;
    if (message.kind === 'stream') {
      const payload = message.payload;
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return;
      const stream = [...this.streams.entries()].find(([, record]) => record.streamId === payload.streamId && record.peerId === payload.peerId);
      if (!stream) return;
      if (payload.event === 'end' || payload.event === 'error') {
        this.streams.delete(stream[0]);
      }
    }
    this.nativeEventSequence = message.eventSeq;
    this.emit(message.kind, message.payload);
  }

  private async answerHost(message: Extract<ChildMessage, { type: 'host-request' }>): Promise<void> {
    const admission = this.pending.get(message.requestId);
    if (!admission || admission.signal?.aborted || this.current.state !== 'running' || this.hostRequests.has(message.hostRequestId)) return;
    const controller = new AbortController();
    const signal = admission.signal ? AbortSignal.any([admission.signal, controller.signal]) : controller.signal;
    this.hostRequests.set(message.hostRequestId, controller);
    try {
      if (!admission.onHostRequest) throw new Error('No host interaction handler is registered');
      const result = await admission.onHostRequest(message.method, message.params, { signal });
      if (!signal.aborted && !this.didExit) this.send({ ...this.envelope, type: 'host-result', hostRequestId: message.hostRequestId, result });
    } catch (error) {
      if (!signal.aborted && !this.didExit) this.send({ ...this.envelope, type: 'host-error', hostRequestId: message.hostRequestId, error: { code: 'DSH_DOMAIN_REQUEST_FAILED', message: error instanceof Error ? error.message : String(error) } });
    } finally { this.hostRequests.delete(message.hostRequestId); }
  }

  private send(message: ParentMessage): void {
    if (this.didExit || !this.child.connected) return;
    try {
      this.child.send(message, error => { if (error && !this.didExit) this.fail(new DshDomainError('DSH_DOMAIN_PROTOCOL_ERROR', 'Worker IPC send failed', { cause: error })); });
    } catch (error) { this.fail(new DshDomainError('DSH_DOMAIN_PROTOCOL_ERROR', 'Worker IPC send failed', { cause: error })); }
  }

  private fail(error: DshDomainError): void {
    this.failure ??= error;
    this.ready.reject(error);
    for (const pending of this.pending.values()) { pending.reject(error); pending.settled.reject(error); pending.release(); }
    this.pending.clear();
    if (this.current.state !== 'starting' && this.current.state !== 'stopping') this.current.state = 'failed';
    if (!this.didExit) void this.processLifetime.terminate();
  }

  private async onExit(code: number | null, signal: NodeJS.Signals | null): Promise<void> {
    this.didExit = true;
    clearTimeout(this.startupTimer);
    clearTimeout(this.shutdownTimer);
    const acknowledged = this.current.state === 'stopping' && this.cleanupConfirmed && code === 0;
    // PID 退出即关闭 admission；平台确认仍在异步进行，不能在这个窗口接受无法执行的新调用。
    this.current.state = acknowledged ? 'stopping' : 'failed';
    if (!acknowledged) this.failure ??= new DshDomainError('DSH_DOMAIN_EXITED', 'Native domain process exited without confirmed cleanup', undefined, { code, signal });
    const resources = await this.processLifetime.release();
    const releasable = (acknowledged || this.startupCleanupConfirmed || this.child.pid === undefined) && resources.verified && !resources.escapedIntervention;
    let quarantineReason = resources.diagnostic ?? (resources.escapedIntervention ? 'Detached native descendant remained after native cleanup' : 'Native exit did not prove release of unknown escaped resources');
    try {
      if (releasable) await this.ownership.release();
      else await this.ownership.quarantine(quarantineReason);
    } catch (error) {
      quarantineReason = `Native resource ownership could not be released: ${error instanceof Error ? error.message : String(error)}`;
      try { await this.ownership.quarantine(quarantineReason); } catch { /* Existing active record still blocks data reuse. */ }
      this.failure ??= new DshDomainError('DSH_DOMAIN_RESOURCE_QUARANTINED', quarantineReason);
    }
    const clean = acknowledged && releasable;
    this.current.state = clean && !this.failure ? 'stopped' : 'failed';
    if (!clean) this.failure ??= new DshDomainError(acknowledged ? 'DSH_DOMAIN_RESOURCE_QUARANTINED' : 'DSH_DOMAIN_EXITED', quarantineReason, undefined, { code, signal });
    if (!releasable && this.failure) {
      this.failure = new DshDomainError(this.failure.code, this.failure.message, { cause: this.failure }, { resourceRelease: 'quarantined', reason: quarantineReason });
    }
    const terminal = this.failure ?? new DshDomainError('DSH_DOMAIN_STOPPED', 'Domain stopped');
    this.ready.reject(terminal);
    for (const pending of this.pending.values()) { pending.reject(terminal); pending.settled.reject(terminal); pending.release(); }
    this.pending.clear();
    for (const stream of this.streams.values()) {
      this.emit('stream', stream.peerId === undefined
        ? { streamId: stream.streamId, event: 'error', error: terminal.message }
        : { peerId: stream.peerId, streamId: stream.streamId, event: 'error', error: { code: terminal.code, message: terminal.message, details: {} } });
    }
    this.streams.clear();
    for (const controller of this.hostRequests.values()) controller.abort(terminal);
    this.hostRequests.clear();
    this.emit('exit', { code, signal, clean });
    this.child.off('message', this.onMessage);
    this.child.stdout?.destroy();
    this.child.stderr?.destroy();
    this.exited.resolve();
  }

  private log(source: string, chunk: Buffer): void {
    for (let start = 0; start < chunk.length; start += LOG_CHUNK_BYTES) this.emit('log', { source, text: chunk.subarray(start, start + LOG_CHUNK_BYTES).toString('utf8') });
  }

  private emit(kind: DshDomainEvent['kind'], payload: DshJson): void {
    const event: DshDomainEvent = { domainId: this.options.domainId, generation: this.options.generation, sequence: ++this.eventSequence, kind, payload };
    for (const listener of this.listeners) { try { listener(event); } catch { /* A subscriber does not own domain admission or transport. */ } }
  }
}
