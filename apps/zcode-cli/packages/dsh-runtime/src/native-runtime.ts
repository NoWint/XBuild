import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import { boot, composeEntries, createRuntimeResolution, loadProfileDirectory, readProfileManifest, PluginPackages, type ProfileContext } from '@deepseek-ai/dsh-app-boot';
import { RETIRED_BUNDLES } from '@deepseek-ai/dsh-official-bundles';
import ClientModuleRegistry from '@deepseek-ai/dsh-client-modules';
import type { HostConnectionHandle, PeerScope } from '@deepseek-ai/dsh-client-connection';
import { createLaunchEnvironmentSnapshot, DSH_LAUNCH_ENVIRONMENT_KEY } from '@deepseek-ai/dsh-launch-environment';
import { installProxyFromEnvironment } from '@deepseek-ai/dsh-http-proxy';
import { Config as SdkConfig, inject as sdkInject, name as sdkName, HarnessSdkJsonRpcServer, type JsonRpcConfig } from '@deepseek-ai/dsh-sdk-jsonrpc-server';
import type { JsonRpcTransportPeer } from '@deepseek-ai/dsh-sdk-protocol';
import { SessionId } from '@deepseek-ai/dsh-session';
import type { TypertGateway } from '@deepseek-ai/dsh-api-gateway';
import type { DshDomainRequest, DshJson } from './contract.js';
import { DshDomainError, hostOverlaySchema, jsonValue, loaderStateSchema, parseFrame, type LoaderStateEntry, type WorkerOptions } from './ipc.js';
import { Uplink } from './uplink.js';

const ACTIVE_FIBER_STATE = 2;
const PINNED_VERSION = '0.2.2-rc.3';
const SDK_STDIO_PACKAGE = '@deepseek-ai/dsh-sdk-jsonrpc-server';
const MAX_FRAME_BYTES = 8 * 1024 * 1024;

/** 稳定序列化用于比较基线，不依赖对象键顺序。 */
function stableConfig(value: unknown): string {
  const encode = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(encode);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.keys(input as object).sort().map(key => [key, encode(Reflect.get(input as object, key))]));
    }
    return input;
  };
  return JSON.stringify(encode(value)) ?? 'undefined';
}

/** 读取 config 的 JSON 快照；无法序列化时返回 undefined（表示不是可持久化配置）。 */
function parseConfig(value: unknown): DshJson | undefined {
  try { return JSON.parse(stableConfig(value)) as DshJson; }
  catch { return undefined; }
}

/** Only this child adapter holds the original Context and native service graph. */
export class NativeRuntime {
  private ctx?: Context;
  private sdk?: HarnessSdkJsonRpcServer;
  private sdkMount?: Promise<void>;
  private peer?: PeerScope;
  private readonly peers = new Map<string, PeerScope>();
  private readonly streams = new Map<string, { peerId: string; uplink: Uplink; done: Promise<void>; resolve(): void }>();
  private disposeProxy?: () => Promise<void>;
  private closeTask?: Promise<void>;
  private diagnostics?: Context;
  private observingCleanup = false;
  private readonly cleanupErrors: unknown[] = [];
  private readonly sdkNotifications = new Set<(method: string, params?: object) => void>();
  private readonly transport: JsonRpcTransportPeer;
  /** 授权基线：本次 boot 实际组合出的条目，用于区分用户改动与启动注入。 */
  private readonly baselineConfigs = new Map<string, string>();
  private readonly baselineDisabled = new Map<string, boolean>();
  /** 持久化串行化：避免并发 loader/config-update 交错写到半截状态。 */
  private persistTask: Promise<void> = Promise.resolve();
  private persistPending = 0;
  private persistError?: unknown;
  private loadedState: LoaderStateEntry[] = [];
  private persistedEmpty = false;
  runtimeVersion = '';

  constructor(private readonly options: WorkerOptions, transport: JsonRpcTransportPeer) {
    this.transport = {
      request: (method, params, signal) => transport.request(method, params, signal),
      notify: (method, params) => {
        for (const notify of this.sdkNotifications) notify(method, params);
        transport.notify(method, params);
      },
    };
  }

  async start(): Promise<void> {
    const manifest = JSON.parse(await readFile(fileURLToPath(import.meta.resolve('@deepseek-ai/dsh/package.json')), 'utf8')) as { version: string };
    if (manifest.version !== PINNED_VERSION) throw new Error(`Expected pinned DSH ${PINNED_VERSION}, got ${manifest.version}`);
    this.runtimeVersion = manifest.version;
    // 上游 loadProfileDirectory 会迁移退休 Bundle 并写回 manifest；授权后的 immutable revision 必须先拒绝这种输入。
    const profileManifest = readProfileManifest('zcode-dsh-domain', this.options.profileDirectory);
    if (profileManifest.dsh?.profile?.bundles?.some(bundle => RETIRED_BUNDLES.has(bundle))) {
      throw new Error('Approved immutable Profile requires retired-bundle migration before authorization');
    }
    const profile = loadProfileDirectory('zcode-dsh-domain', this.options.profileDirectory, this.options.installationAnchor);
    if (profile.skippedBundles.length) throw new Error(`Profile skipped selected bundles: ${profile.skippedBundles.map(bundle => `${bundle.packageName}: ${bundle.reason}`).join('; ')}`);
    const patches = [...profile.layers.flatMap(layer => layer.patches), ...profile.patches];
    let overlay: string | undefined;
    try { overlay = await readFile(join(profile.dir, '.xbuild-host-overlay.json'), 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (overlay !== undefined) {
      // Host overlay 也是授权代码基线的一部分；无效数组必须在原生 boot 前拒绝，不能忽略配置。
      const parsed = parseFrame(hostOverlaySchema, JSON.parse(overlay));
      if (!parsed) throw new Error('Host-owned overlay must be a bounded JSON patch object array');
      patches.push(...parsed);
    }
    // 域自有运行时配置层：承接插件 ctx.loader.update() 的 patch-owned 变更。
    // 上游把这类变更留在内存 patch 而非 cordis.patch.yml 的 insert 行，缺少此层时重启即丢失。
    const persistedState = await this.readLoaderState();
    // 基线 = 不含域持久化层的授权组合；重启后追加该层之前，patch 栈与此完全一致。
    this.captureBaselineFrom(composeEntries([patches]));
    if (persistedState.length) patches.push(...persistedState.map(entry => ({ ...entry })));
    // 精确模块 carrier 映射已授权：保留原始 Config/inject/name，只把 stdio 部署换成独立 IPC。
    const entries = composeEntries([patches]);
    const sdkRows: string[] = [];
    const visit = (rows: typeof entries): void => {
      for (const row of rows) {
        if (row.name === SDK_STDIO_PACKAGE) sdkRows.push(row.id);
        if (Array.isArray(row.config)) visit(row.config as typeof entries);
      }
    };
    visit(entries);
    patches.push(...sdkRows.map(id => ({ id, name: 'cordis:zcode-sdk-ipc' })));
    const rootConfig = join(this.options.dataDirectory, 'cordis.runtime.yml');
    // 上游 Loader 可持久化树；mutable root 必须在域 data 中，不能修改已授权 revision 的完整性基线。
    await writeFile(rootConfig, '[]\n');
    const resolution = await createRuntimeResolution({ installAnchor: this.options.installationAnchor, profile });
    const environment = createLaunchEnvironmentSnapshot([{ source: 'process', values: { ...process.env } as Record<string, string> }]);
    this.disposeProxy = await installProxyFromEnvironment(environment, message => process.stderr.write(`${message}\n`));
    const profileContext: ProfileContext = {
      name: profile.name, dir: profile.dir, patchPath: profile.patchPath, installAnchor: this.options.installationAnchor,
      cwd: this.options.workspace.workspacePath, home: this.options.dataDirectory,
      startedBundles: profile.layers.map(layer => layer.packageName), overlays: [], telemetryDisabledEnv: this.options.environment.DSH_TELEMETRY_DISABLED,
    };
    this.ctx = await boot('zcode-dsh-domain', rootConfig, patches, async ctx => {
      this.ctx = ctx;
      // Cordis 原始 Fiber 清理会吞并 rejection 并 logger.error；独立真实 Context 的 exporter 必须跨越 root disposal。
      this.diagnostics = new Context();
      this.diagnostics.logger = ctx.logger;
      this.diagnostics.logger.exporter({ levels: { default: 0 }, export: message => {
        if (this.observingCleanup && message.type === 'error') this.cleanupErrors.push(...message.args);
      } });
      ctx.provide('profileContext', profileContext);
      // Include.filename 保持 domain-data 写回位置；公开 Loader hook 保留原 Profile 的 resolution/资源 baseUrl。
      ctx.on('loader/patch-context', (entry, next) => {
        const tree = entry.parent.tree;
        if (tree.ctx.fiber.entry?.options.id === 'include') tree.ctx.baseUrl = new URL('./', pathToFileURL(join(profile.dir, 'package.json'))).href;
        return next();
      });
      ctx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, environment);
      ctx.loader.builtins['zcode-sdk-ipc'] = {
        name: sdkName, inject: sdkInject, Config: SdkConfig,
        apply: (sdkCtx: Context, config: JsonRpcConfig) => {
          if (this.sdk) throw new Error('One domain cannot mount multiple SDK deployment rows');
          const server = new HarnessSdkJsonRpcServer(sdkCtx, this.transport, { maxTokensAsSuccess: config.maxTokensAsSuccess });
          this.sdk = server;
          sdkCtx.provide('sdkSessionActivation', { ready: true });
          sdkCtx.effect(() => () => server.shutdown(), 'zcode SDK IPC carrier');
        },
      };
      await ctx.plugin(PluginPackages, { resolution });
    }, pathToFileURL(join(profile.dir, 'package.json')).href);
    if (this.ctx.fiber.state !== ACTIVE_FIBER_STATE || !this.ctx.get('loader')) throw new Error('Native Profile disposed before activation');
    // 上游默认仅 required ids 失败会拒绝；依赖域已授权的所有 enabled rows 都必须完整激活。
    for (const entry of this.ctx.loader.entries()) {
      if (entry.disabled) continue;
      if (entry.fiber?.state !== ACTIVE_FIBER_STATE) {
        throw new Error(`Enabled plugin ${entry.options.id} (${entry.options.name}) did not activate`);
      }
    }
    if (!this.ctx.get('clientModules')) await this.ctx.plugin(ClientModuleRegistry);
    const connection = this.ctx.get('connection') as HostConnectionHandle | undefined;
    if (connection) this.peer = connection.createPeer({ principal: { kind: 'owner' }, interactions: 'none' });
    // 基线已在 boot 前由授权组合记录；此处只挂载变更监听。
    this.observeLoaderChanges();
  }

  /** 记录授权基线，用于把用户改动与启动注入（如 SDK carrier row）区分开。 */
  private captureBaseline(): void {
    for (const entry of this.loaderEntries()) {
      const id = entry.options.id;
      this.baselineConfigs.set(id, stableConfig(entry.options.config));
      this.baselineDisabled.set(id, entry.disabled);
    }
  }

  /**
   * 从授权组合结果记录基线。
   * 必须早于域持久化层生效：否则重启后「当前值 == 基线」，diff 恒为空，用户改动会被静默清空。
   */
  private captureBaselineFrom(rows: readonly { id: string; config?: unknown; disabled?: boolean | null }[]): void {
    const walk = (list: readonly { id: string; config?: unknown; disabled?: boolean | null }[]): void => {
      for (const row of list) {
        this.baselineConfigs.set(row.id, stableConfig(row.config));
        this.baselineDisabled.set(row.id, Boolean(row.disabled));
        if (Array.isArray(row.config)) walk(row.config as typeof list);
      }
    };
    walk(rows);
  }

  /**
   * 监听上游 Loader 的树变更并持久化增量。
   * 上游 Include 在 commit 后同步 emit 'loader/config-update'，所以监听保持同步注册、异步落盘。
   */
  private observeLoaderChanges(): void {
    const ctx = this.context();
    ctx.on('loader/config-update', () => { this.schedulePersist(); });
  }

  private loaderEntries(): { options: { id: string; config?: unknown }; disabled: boolean }[] {
    const loader = this.ctx?.get('loader') as { entries(): Iterable<{ options: { id: string; config?: unknown }; disabled: boolean }> } | undefined;
    return loader ? [...loader.entries()] : [];
  }

  /** 只把与基线不同的 config/disabled 写成层条目；不持久化缺失条目或启动注入行。 */
  private currentLoaderState(): LoaderStateEntry[] {
    const state: LoaderStateEntry[] = [];
    for (const entry of this.loaderEntries()) {
      const id = entry.options.id;
      const persisted = this.readPersistedEntry(id);
      if (persisted && !this.baselineConfigs.has(id)) {
        // 上一代持久化过、本代基线不再包含的条目：保留其既有层值，避免丢失用户偏好。
        state.push(persisted);
        continue;
      }
      if (!this.baselineConfigs.has(id)) continue;
      const baselineConfig = this.baselineConfigs.get(id);
      const baselineDisabled = this.baselineDisabled.get(id) ?? false;
      const config = stableConfig(entry.options.config);
      const changedConfig = config !== baselineConfig;
      const changedDisabled = entry.disabled !== baselineDisabled;
      if (!changedConfig && !changedDisabled) continue;
      const next: LoaderStateEntry = { id };
      if (changedConfig) next.config = parseConfig(entry.options.config);
      if (changedDisabled) next.disabled = entry.disabled;
      state.push(next);
    }
    return state;
  }

  private readPersistedEntry(id: string): LoaderStateEntry | undefined {
    return this.loadedState.find(entry => entry.id === id);
  }

  private schedulePersist(): void {
    this.persistPending += 1;
    this.persistTask = this.persistTask
      .then(() => this.writeLoaderState())
      .catch(error => { this.persistError = error; })
      .finally(() => { this.persistPending -= 1; });
  }

  /** 原子写入：临时文件 + rename，避免半截状态；超限拒绝而不是写部分内容。 */
  private async writeLoaderState(): Promise<void> {
    const entries = this.loaderEntries();
    // loader service 已不可读时（dispose 后）不得把状态写成空数组覆盖既有用户配置。
    if (entries.length === 0 && this.loadedState.length > 0) return;
    const state = this.currentLoaderState();
    if (state.length === 0 && this.persistedEmpty) return;
    const text = `${JSON.stringify(state)}\n`;
    if (Buffer.byteLength(text) > MAX_FRAME_BYTES) {
      this.persistError = new Error('Domain loader state exceeds the bounded frame size');
      return;
    }
    const target = this.loaderStatePath();
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, text);
    await rename(tmp, target);
    this.loadedState = state;
    this.persistedEmpty = state.length === 0;
  }

  private loaderStatePath(): string {
    return join(this.options.dataDirectory, 'loader-state.json');
  }

  /** boot 前读取并严格校验；损坏／超限 fail closed，不静默丢弃用户配置。 */
  private async readLoaderState(): Promise<LoaderStateEntry[]> {
    let raw: string;
    try { raw = await readFile(this.loaderStatePath(), 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') { this.persistedEmpty = true; return []; }
      throw error;
    }
    const parsed = parseFrame(loaderStateSchema, JSON.parse(raw));
    if (!parsed) throw new Error('Domain loader state must be a bounded patch array');
    this.loadedState = parsed;
    this.persistedEmpty = parsed.length === 0;
    return parsed;
  }

  async sdkRequest(
    method: string,
    params: DshJson,
    signal: AbortSignal,
    retain?: (completion: Promise<void>) => void,
  ): Promise<DshJson> {
    const ctx = this.context();
    this.sdkMount ??= (async () => {
      if (!ctx.get('agents') || !ctx.get('workingDirectory') || !ctx.get('llm')) throw new Error('SDK requires Profile-owned agents, workingDirectory and llm services');
      if (!this.sdk) this.sdk = new HarnessSdkJsonRpcServer(ctx, this.transport);
    })();
    await this.sdkMount;
    if (params !== null && (typeof params !== 'object' || Array.isArray(params))) throw new TypeError('SDK params must be an object or null');
    const sessionId = params && typeof params.sessionId === 'string' ? params.sessionId : undefined;
    let commandId: string | undefined;
    const completedCommands = new Set<string>();
    let completeCommand!: () => void;
    const commandCompleted = new Promise<void>(resolve => { completeCommand = resolve; });
    const observeCommand = (notification: string, payload?: object) => {
      if (notification !== 'session.query.completed' || !payload || Reflect.get(payload, 'sessionId') !== sessionId) return;
      const completed = Reflect.get(payload, 'commandId');
      if (typeof completed !== 'string') return;
      completedCommands.add(completed);
      if (completed === commandId) completeCommand();
    };
    if (method === 'session/query') this.sdkNotifications.add(observeCommand);
    const cancel = () => {
      if (sessionId) ctx.get('agents')?.get(SessionId(sessionId))?.cancel({ kind: 'user' });
      // 取消先结束 command observer 等待，再 await 原始 Agent/子任务清理，不把取消当作成功活动完成。
      completeCommand();
    };
    // 创建 Session 是异步的；cancel 可能先于 Agent 发布，后续 running 通知必须再次检查。
    const releaseStatus = ctx.on('agent/status', ({ agent }) => { if (signal.aborted && agent.session.id === sessionId) agent.cancel({ kind: 'user' }); });
    signal.addEventListener('abort', cancel, { once: true });
    const release = () => { signal.removeEventListener('abort', cancel); releaseStatus(); this.sdkNotifications.delete(observeCommand); };
    let retained = false;
    try {
      signal.throwIfAborted();
      const result = await this.sdk!.handleRequest(method, params === null ? undefined : params as Record<string, unknown>);
      const receipt = result !== null && typeof result === 'object' && 'messageId' in result;
      const execution = result !== null && typeof result === 'object' && 'kind' in result && result.kind === 'command' && 'execution' in result
        && result.execution !== null && typeof result.execution === 'object' ? result.execution : undefined;
      if (execution && 'commandId' in execution && typeof execution.commandId === 'string') {
        commandId = execution.commandId;
        if (completedCommands.has(commandId) || signal.aborted) completeCommand();
      }
      if (sessionId && (receipt || commandId) && retain && (method === 'session/prompt' || method === 'session/query')) {
        // 回执只证明入队；原始 wait 同时观察 Agent 与子任务，不能在回执返回或 turn/end 时撤销取消权。
        retained = true;
        retain((async () => {
          // command 回执不代表 command-admitted 工作结束；先等原始 correlated completion，再等真实子任务树。
          if (commandId) await commandCompleted;
          await this.sdk!.handleRequest('session/wait', { sessionId });
        })().finally(release));
      }
      signal.throwIfAborted();
      return jsonValue(result);
    } finally { if (!retained) release(); }
  }

  plugins(): DshJson {
    return [...this.context().loader.entries()].map(entry => ({
      id: entry.options.id, name: entry.options.name,
      state: entry.disabled ? 'disabled' : entry.fiber?.state === ACTIVE_FIBER_STATE ? 'active' : 'inactive',
    }));
  }

  graph(): DshJson { return jsonValue(this.context().clientModules.graph()); }

  openPeer(peerId: string, interactions: 'answer' | 'none'): DshJson {
    if (this.peers.has(peerId)) throw new Error('Native Peer is already open');
    const connection = this.context().get('connection') as HostConnectionHandle | undefined;
    if (!connection) throw new Error('Profile does not provide native Connection');
    this.peers.set(peerId, connection.createPeer({ principal: { kind: 'owner' }, interactions }));
    return {};
  }

  async closePeer(peerId: string): Promise<DshJson> {
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error('Native Peer is not open');
    this.peers.delete(peerId);
    const streams = [...this.streams.values()].filter(stream => stream.peerId === peerId);
    await peer.dispose();
    await Promise.all(streams.map(stream => stream.done));
    return {};
  }

  async openRemoteStream(request: Extract<DshDomainRequest, { kind: 'remote-stream' }>, signal: AbortSignal) {
    const peer = this.selectPeer(request.peerId);
    const gateway = this.gateway();
    const key = JSON.stringify([request.peerId, request.streamId]);
    if (this.streams.has(key)) throw new Error('Native stream is already open');
    const controller = new AbortController();
    const lifetime = AbortSignal.any([signal, peer.signal, controller.signal]);
    const uplink = new Uplink(request.endpoint, lifetime, error => controller.abort(error));
    let resolve!: () => void;
    const done = new Promise<void>(yes => { resolve = yes; });
    const record = { peerId: request.peerId, uplink, done, resolve };
    this.streams.set(key, record);
    const close = async () => {
      await uplink.return();
      if (this.streams.get(key) === record) this.streams.delete(key);
      resolve();
    };
    try {
      const values = await gateway.wireStream.open(request.endpoint, request.payload, uplink, peer, lifetime);
      return { values, close, failure: gateway.wireStream.failure };
    } catch (error) { await close(); throw error; }
  }

  uplink(request: Extract<DshDomainRequest, { kind: 'stream-uplink' }>): DshJson {
    this.selectPeer(request.peerId);
    const stream = this.streams.get(JSON.stringify([request.peerId, request.streamId]));
    if (!stream) throw new Error('Native stream is not open');
    stream.uplink.push(request.value, request.end);
    return {};
  }

  remoteFailure(error: unknown): DshJson {
    const gateway = this.context().get('typertGateway') as TypertGateway | undefined;
    return gateway ? jsonValue(gateway.wireStream.failure(error))
      : { code: 'DSH_DOMAIN_REQUEST_FAILED', message: error instanceof Error ? error.message : String(error), details: {} };
  }

  async fetch(request: Extract<DshDomainRequest, { kind: 'fetch' }>, signal: AbortSignal): Promise<Response> {
    const ctx = this.context();
    const origin = 'http://dsh.domain.local';
    if (!request.path.startsWith('/') || request.path.startsWith('//')) throw new TypeError('Fetch requires a domain-relative path');
    const url = new URL(request.path, origin);
    if (url.origin !== origin) throw new TypeError('Fetch cannot select an external authority');
    const native = new Request(url, {
      method: request.method ?? 'GET', headers: request.headers,
      ...(request.bodyBase64 === undefined ? {} : { body: Buffer.from(request.bodyBase64, 'base64') }), signal,
    });
    signal.throwIfAborted();
    if (url.pathname.startsWith('/plugins/')) return ctx.clientModules.fetchBundle(native);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const connection = ctx.get('connection') as (HostConnectionHandle & { createSharedFetchHandler(channel: '/api'): { fetch(request: Request, peer: PeerScope): Promise<Response> } }) | undefined;
      if (!connection) throw new Error('Profile does not provide native Connection');
      // 使用真实 Connection exact-route / interceptor 和 Peer，不再造 RPC 或 MCP 转换。
      return connection.createSharedFetchHandler('/api').fetch(native, this.selectPeer(request.peerId));
    }
    return new Response('not found', { status: 404 });
  }

  cancelAll(): void {
    for (const agent of this.ctx?.get('agents')?.list() ?? []) agent.cancel({ kind: 'user' });
  }

  close(): Promise<void> {
    this.closeTask ??= (async () => {
      const failures: unknown[] = [];
      this.cancelAll();
      for (const peer of this.peers.values()) {
        try { await peer.dispose(); } catch (error) { failures.push(error); }
      }
      this.peers.clear();
      for (const dispose of [() => this.sdk?.shutdown(), () => this.peer?.dispose()]) {
        try { await dispose(); } catch (error) { failures.push(error); }
      }
      // loaderEntries() 依赖 loader service，dispose 后即不可读；先落盘再 dispose，
      // 否则最终一次重算会把状态写成空数组并抹掉用户配置。
      try {
        await this.persistTask;
        await this.writeLoaderState();
      } catch (error) { failures.push(error); }
      this.observingCleanup = true;
      try { await this.ctx?.fiber.dispose(); } catch (error) { failures.push(error); }
      this.observingCleanup = false;
      // dispose 期间仍可能触发 loader/config-update；等待其在途写入，不再重算已不可读的状态。
      try {
        while (this.persistPending > 0) await this.persistTask;
        await this.persistTask;
        if (this.persistError) failures.push(this.persistError);
      } catch (error) { failures.push(error); }
      failures.push(...this.cleanupErrors);
      for (const dispose of [() => this.disposeProxy?.(), () => this.diagnostics?.fiber.dispose()]) {
        try { await dispose(); } catch (error) { failures.push(error); }
      }
      if (failures.length) throw new AggregateError(failures, 'Native domain cleanup failed');
    })();
    return this.closeTask;
  }

  private context(): Context {
    if (!this.ctx) throw new DshDomainError('DSH_DOMAIN_STARTUP_FAILED', 'Native Context is not initialized');
    return this.ctx;
  }

  private selectPeer(peerId?: string): PeerScope {
    const peer = peerId === undefined ? this.peer : this.peers.get(peerId);
    if (!peer || peer.signal.aborted) throw new Error('Native Peer is not open');
    return peer;
  }

  private gateway(): TypertGateway {
    const gateway = this.context().get('typertGateway') as TypertGateway | undefined;
    if (!gateway) throw new Error('Profile does not provide native TypertGateway');
    return gateway;
  }
}
