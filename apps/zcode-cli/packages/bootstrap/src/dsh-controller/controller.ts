import type { DshDomainRecord, DshPreparedRevision } from "@zcode/adapters/dsh-plugins";
import type { DshDomain } from "@zcode/dsh-runtime";
import {
  dshDispatchSchema, dshEventSchema, dshOverviewSchema,
  type DshDiagnostic, type DshDispatch, type DshEvent, type DshInstalledDomain,
  type DshLocalDiscovery, type DshResult, type DshScope,
} from "@zcode/shared/dsh-compat";
import type { DshController, DshControllerOptions } from "./contract.js";
import { DshAttachments } from "./attachments.js";
import { DshControllerError, diagnostic, jsonResult, revisionSummary, sameScope } from "./projection.js";

interface RunningDomain {
  native: DshDomain;
  revision: DshPreparedRevision;
  accepting: boolean;
  sequence: number;
  release(): void;
}
interface Failure { state: "failed" | "environment-limited"; diagnostic: DshDiagnostic; cleanupUnconfirmed?: true }

export function createDshController(options: DshControllerOptions): DshController {
  return new Controller(options);
}

/** The sole parent owner for domain lifecycle and transport attachment admission. */
class Controller implements DshController {
  private readonly running = new Map<string, RunningDomain>();
  private readonly generations = new Map<string, number>();
  private readonly mutations = new Map<string, Promise<void>>();
  private readonly failures = new Map<string, Failure>();
  private readonly listeners = new Set<(event: DshEvent) => void>();
  private readonly attachments = new DshAttachments((event) => this.publish(event));
  private readonly operations = new Set<{ abort: AbortController; settled: Promise<void> }>();
  private closing = false;
  private shutdownTask?: Promise<void>;

  constructor(private readonly options: DshControllerOptions) {}

  subscribe(listener: (event: DshEvent) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private publish(event: DshEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* A presentation subscriber does not own admission. */ }
    }
  }

  private assertOpen(): void {
    if (this.closing) throw new DshControllerError("DSH_CONTROLLER_CLOSED", "Native plugin controller is shutting down");
  }

  async dispatch(raw: DshDispatch, options: { signal?: AbortSignal } = {}): Promise<DshResult> {
    this.assertOpen();
    const input = dshDispatchSchema.parse(raw);
    const abort = new AbortController();
    const done = Promise.withResolvers<void>();
    const operation = { abort, settled: done.promise };
    // prepare 尚未产生 domainId 时也属于 controller；按域 mutation 表无法覆盖安装和目录 IO。
    this.operations.add(operation);
    const signal = options.signal ? AbortSignal.any([abort.signal, options.signal]) : abort.signal;
    try {
      signal.throwIfAborted();
      const result = await this.dispatchOperation(input, { signal });
      signal.throwIfAborted();
      return result;
    } finally {
      this.operations.delete(operation);
      done.resolve();
    }
  }

  private async dispatchOperation(input: DshDispatch, options: { signal: AbortSignal }): Promise<DshResult> {
    const { scope, command } = input;
    switch (command.kind) {
      case "overview": return { value: jsonResult(await this.overview(scope, options.signal)) };
      case "add-catalog": return { value: jsonResult((await this.options.catalogs(scope).add(command.url, options)).catalog) };
      case "refresh-catalog": return { value: jsonResult((await this.options.catalogs(scope).refresh(command.catalogId, options)).catalog) };
      case "remove-catalog": await this.options.catalogs(scope).remove(command.catalogId); return { value: { removed: true } };
      case "prepare": {
        let source = command.source;
        if (source === undefined) {
          const catalog = (await this.options.catalogs(scope).load()).find((entry) => entry.catalog.id === command.catalogId);
          source = catalog?.catalog.entries.find((entry) => entry.id === command.entryId)?.source;
          if (source === undefined) throw new DshControllerError("DSH_CATALOG_ENTRY_UNKNOWN", "Catalog entry is unavailable");
        }
        options.signal.throwIfAborted();
        const prepared = await this.options.packages.prepare({
          source, scope, domainId: command.domainId,
          baseBundles: command.baseBundles, configPatches: command.configPatches,
          signal: options.signal,
        });
        return { value: jsonResult(revisionSummary(prepared)) };
      }
      case "grant": return await this.mutate(command.domainId, options.signal, async () => ({ value: jsonResult(revisionSummary(await this.options.packages.authorize(command.domainId, command.grant, scope))) }));
      case "configure": return await this.mutate(command.domainId, options.signal, async () => ({ value: jsonResult(revisionSummary(await this.options.packages.configure(command.domainId, command.patches, scope))) }));
      case "update": return await this.mutate(command.domainId, options.signal, async () => ({ value: jsonResult(revisionSummary(await this.options.packages.update(command.domainId, scope, options))) }));
      case "set-enabled": {
        const active = this.running.get(command.domainId);
        if (active && !sameScope(active.revision.scope, scope)) throw new DshControllerError("DSH_SCOPE_MISMATCH", "Domain belongs to another workspace");
        if (!command.enabled && active) active.accepting = false;
        return await this.mutate(command.domainId, options.signal, async () => {
          const record = await this.record(command.domainId, scope);
          if (!command.enabled) {
            await this.stop(command.domainId);
            options.signal.throwIfAborted();
            await this.options.packages.setEnabled(command.domainId, false, scope);
            this.failures.delete(command.domainId);
            return { value: { enabled: false, state: "stopped" } };
          }
          const revision = record.preparedRevision ?? record.activeRevision;
          if (!revision) throw new DshControllerError("DSH_AWAITING_TRUST", "Domain has no prepared revision");
          await this.activate(record, revision, scope, options.signal);
          return { value: { enabled: true, state: "running" } };
        });
      }
      case "rollback": return await this.mutate(command.domainId, options.signal, async () => {
        const record = await this.record(command.domainId, scope);
        const revision = command.revision ?? record.previousRevision;
        if (!revision) throw new DshControllerError("DSH_REVISION_UNKNOWN", "No retained rollback revision exists");
        await this.activate(record, revision, scope, options.signal);
        return { value: { enabled: true, state: "running", revision } };
      });
      case "uninstall": {
        if (command.deleteData) {
          await this.record(command.domainId, scope);
          // 内存 failed 标记不是持久数据 owner；原生 maintenance lease 尚未接线时，删除数据必须在副作用前拒绝。
          throw new DshControllerError("DSH_NATIVE_DATA_MAINTENANCE_UNAVAILABLE", "Native data removal requires verified maintenance ownership");
        }
        const active = this.running.get(command.domainId);
        if (active && !sameScope(active.revision.scope, scope)) throw new DshControllerError("DSH_SCOPE_MISMATCH", "Domain belongs to another workspace");
        if (active) active.accepting = false;
        return await this.mutate(command.domainId, options.signal, async () => {
          await this.record(command.domainId, scope);
          await this.stop(command.domainId);
          options.signal.throwIfAborted();
          await this.options.packages.setEnabled(command.domainId, false, scope);
          options.signal.throwIfAborted();
          await this.options.packages.uninstall(command.domainId, scope, { deleteData: command.deleteData });
          this.failures.delete(command.domainId);
          return { value: { removed: true } };
        });
      }
      case "attach": {
        const active = this.running.get(command.domainId);
        if (!active || !active.accepting || active.native.info.state !== "running") throw new DshControllerError("DSH_DOMAIN_NOT_RUNNING", "Native domain is not running");
        if (!sameScope(active.revision.scope, scope)) throw new DshControllerError("DSH_SCOPE_MISMATCH", "Domain belongs to another workspace");
        return { value: jsonResult(await this.attachments.attach(active.native, scope, command.attachmentId, command.clientMode, active.revision.grant!.nativeUi)) };
      }
      case "detach": await this.attachments.detach(command.attachment, scope); return { value: { detached: true } };
      case "invoke": {
        const active = this.running.get(command.attachment.domainId);
        if (!active?.accepting) throw new DshControllerError("DSH_ATTACHMENT_STALE", "Native domain is no longer accepting calls");
        return { value: await this.attachments.invoke(command.attachment, scope, command.callId, command.request, options.signal) };
      }
      case "cancel": return { value: { cancelled: this.attachments.cancel(command.attachment, scope, command.callId) } };
      case "answer": this.attachments.answer(command.attachment, scope, command.hostRequestId, command.result); return { value: { answered: true } };
      case "events": return { value: jsonResult(this.attachments.replay(command.attachment, scope, command.afterSequence)) };
    }
  }

  private async record(domainId: string, scope: DshScope): Promise<DshDomainRecord> {
    const record = (await this.options.packages.list(scope)).find((entry) => entry.domainId === domainId);
    if (!record) throw new DshControllerError("DSH_DOMAIN_UNKNOWN", "Domain is not installed in this scope");
    return record;
  }

  private mutate<T>(domainId: string, signal: AbortSignal, action: () => Promise<T>): Promise<T> {
    const previous = this.mutations.get(domainId) ?? Promise.resolve();
    const run = previous.then(() => { this.assertOpen(); signal.throwIfAborted(); return action(); });
    const settled = run.then(() => {}, () => {}).finally(() => {
      if (this.mutations.get(domainId) === settled) this.mutations.delete(domainId);
    });
    this.mutations.set(domainId, settled);
    return run;
  }

  private async activate(record: DshDomainRecord, target: string, scope: DshScope, signal: AbortSignal): Promise<void> {
    const revision = await this.options.packages.verify(record.domainId, target, scope);
    signal.throwIfAborted();
    if (this.failures.get(record.domainId)?.cleanupUnconfirmed) throw new DshControllerError("DSH_DOMAIN_RESOURCE_QUARANTINED", "Native cleanup remains unconfirmed");
    const grant = revision.grant!;
    if (grant.executionMode !== "trusted-process" || grant.filesystem !== "unrestricted" || !grant.network || !grant.subprocess) {
      const error = new DshControllerError("DSH_CONFINEMENT_UNAVAILABLE", "This launcher cannot enforce the requested native-code confinement; explicit trusted-process authorization is required");
      this.failures.set(record.domainId, { state: "environment-limited", diagnostic: diagnostic(error) });
      throw error;
    }
    const current = this.running.get(record.domainId);
    if (current?.accepting && current.native.info.state === "running" && current.revision.revision === target) return;
    await this.stop(record.domainId);
    signal.throwIfAborted();
    try {
      await this.start(record, revision, signal);
      this.assertOpen();
      signal.throwIfAborted();
      await this.options.packages.activate(record.domainId, target, scope);
      this.failures.delete(record.domainId);
    } catch (error) {
      await this.stop(record.domainId).catch(() => {});
      const cleanupUnconfirmed = this.failures.get(record.domainId)?.cleanupUnconfirmed;
      this.failures.set(record.domainId, { state: "failed", diagnostic: diagnostic(error), ...(cleanupUnconfirmed ? { cleanupUnconfirmed } : {}) });
      // 候选失败不提交 active revision；仍保留的旧代码必须按新 generation 真正恢复，而不是改回一个状态字段。
      if (!this.closing && !signal.aborted && !cleanupUnconfirmed && record.activeRevision && record.activeRevision !== target && record.enabled) {
        try {
          const previous = await this.options.packages.verify(record.domainId, record.activeRevision, scope);
          await this.start(record, previous, signal);
        } catch (restoreError) {
          this.failures.set(record.domainId, { state: "failed", diagnostic: diagnostic(restoreError) });
          throw new DshControllerError("DSH_ROLLBACK_FAILED", "Candidate failed and the retained revision could not restart", { cause: new AggregateError([error, restoreError]) });
        }
      }
      throw error;
    }
  }

  private async start(record: DshDomainRecord, revision: DshPreparedRevision, signal: AbortSignal): Promise<void> {
    this.assertOpen();
    const generation = (this.generations.get(record.domainId) ?? 0) + 1;
    this.generations.set(record.domainId, generation);
    const native = await this.options.startDomain({
      domainId: record.domainId, revision: revision.revision, generation,
      workspace: record.scope, profileDirectory: revision.profileDirectory,
      installationAnchor: this.options.installationAnchor,
      dataDirectory: record.dataDirectory, environment: { ...this.options.environment },
      runner: this.options.runner,
    });
    if (this.closing || signal.aborted) {
      try { await native.stop(); }
      catch (error) {
        this.failures.set(record.domainId, { state: "failed", diagnostic: diagnostic(error), cleanupUnconfirmed: true });
        throw error;
      }
      signal.throwIfAborted();
      throw new DshControllerError("DSH_CONTROLLER_CLOSED", "Controller closed while domain was starting");
    }
    const entry: RunningDomain = { native, revision, accepting: true, sequence: 0, release: () => {} };
    this.running.set(record.domainId, entry);
    entry.release = native.subscribe((event) => {
      this.attachments.onNativeEvent(native, event);
      if (event.kind === "exit") {
        entry.accepting = false;
        this.lifecycle(entry, native.info.state);
      }
    });
    this.lifecycle(entry, "running");
  }

  private lifecycle(entry: RunningDomain, state: string): void {
    this.publish(dshEventSchema.parse({
      scope: entry.revision.scope, domainId: entry.native.info.domainId,
      revision: entry.revision.revision, generation: entry.native.info.generation,
      sequence: ++entry.sequence, kind: "lifecycle", payload: { state },
    }));
  }

  private async stop(domainId: string): Promise<void> {
    const entry = this.running.get(domainId);
    if (!entry) {
      // running 引用释放不代表原生清理已确认；重试卸载不能据此抹掉 quarantine 的持久保护。
      if (this.failures.get(domainId)?.cleanupUnconfirmed) throw new DshControllerError("DSH_DOMAIN_RESOURCE_QUARANTINED", "Native cleanup remains unconfirmed");
      return;
    }
    entry.accepting = false;
    this.lifecycle(entry, "stopping");
    // stop 会拒绝独立 peer-close 在途请求；整域清理必须只由原生 stop 一条路径承担。
    const releaseAttachments = this.attachments.revokeDomain(entry.native);
    try {
      await entry.native.stop();
      this.lifecycle(entry, "stopped");
    } catch (error) {
      // 运行对象释放不等于清理成功；必须保留原始失败，不能回落到 stopped 展示。
      this.failures.set(domainId, { state: "failed", diagnostic: diagnostic(error), cleanupUnconfirmed: true });
      this.lifecycle(entry, "failed");
      throw error;
    } finally {
      await releaseAttachments();
      entry.release();
      this.running.delete(domainId);
    }
  }

  private async overview(scope: DshScope, signal: AbortSignal) {
    const catalogs = (await this.options.catalogs(scope).load()).map((entry) => entry.catalog);
    signal.throwIfAborted();
    const records = await this.options.packages.list(scope);
    signal.throwIfAborted();
    // 本机探测是只读附加信息：失败只体现在 local.diagnostics，不能让整个 overview 失败，
    // 否则用户连已安装插件列表都看不到。
    let local: DshLocalDiscovery | undefined;
    if (this.options.discoverLocal) {
      try {
        local = await this.options.discoverLocal({ signal });
      } catch (error) {
        if (signal.aborted) throw error;
        local = {
          home: "",
          profiles: [],
          plugins: [],
          diagnostics: [{
            subject: "local-dsh",
            message: error instanceof Error ? error.message : String(error),
          }],
        };
      }
    }
    const domains: DshInstalledDomain[] = [];
    for (const record of records) {
      signal.throwIfAborted();
      const selected = record.preparedRevision ?? record.activeRevision;
      const revision = selected ? await this.options.packages.readRevision(record.domainId, selected, scope) : undefined;
      const active = this.running.get(record.domainId);
      const failure = this.failures.get(record.domainId);
      const state = active?.native.info.state === "running" && active.accepting ? "running"
        : failure?.state ?? (revision?.state === "awaiting-trust" ? "awaiting-trust" : "stopped");
      domains.push({
        domainId: record.domainId, scope: record.scope, enabled: record.enabled,
        activeRevision: record.activeRevision, preparedRevision: record.preparedRevision,
        previousRevision: record.previousRevision, revisions: record.revisions,
        ...(revision ? { revision: revisionSummary(revision) } : {}),
        state, generation: this.generations.get(record.domainId) ?? 0,
        ...(active ? { runtimeVersion: active.native.info.runtimeVersion } : {}),
        compatibility: state === "environment-limited" ? "environment-limited" : state === "running" ? "native-runtime-required" : "unverified",
        diagnostics: failure ? [failure.diagnostic] : [],
      });
    }
    // 标记本机已安装的插件，避免用户重复导入同一包。
    if (local) {
      const installed = new Set(records.map((record) => record.domainId));
      local = {
        ...local,
        plugins: local.plugins.map((plugin) => ({
          ...plugin,
          alreadyInstalled: installed.has(plugin.packageName),
        })),
      };
    }
    return dshOverviewSchema.parse({
      catalogs, domains, runtimeVersions: this.options.runtimeVersions,
      ...(local ? { local } : {}),
    });
  }

  shutdown(): Promise<void> {
    if (this.shutdownTask) return this.shutdownTask;
    const shutdown = Promise.withResolvers<void>();
    this.shutdownTask = shutdown.promise;
    this.closing = true;
    for (const entry of this.running.values()) entry.accepting = false;
    for (const operation of this.operations) operation.abort.abort(new DshControllerError("DSH_CONTROLLER_CLOSED", "Native plugin controller is shutting down"));
    void (async () => {
      await Promise.allSettled([...this.operations].map((operation) => operation.settled));
      await Promise.allSettled(this.mutations.values());
      const results = await Promise.allSettled([...this.running.keys()].map((id) => this.stop(id)));
      this.listeners.clear();
      const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
      if (errors.length) throw new AggregateError(errors, "Native plugin controller shutdown failed");
    })().then(shutdown.resolve, shutdown.reject);
    return this.shutdownTask;
  }
}
