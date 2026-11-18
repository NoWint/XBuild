import { createHash, randomUUID } from "node:crypto";
import { lstat, readdir, rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type {
  DshData,
  DshDomainGrant,
  DshDomainRecord,
  DshHttpsRequest,
  DshPackageCommand,
  DshPackageStore,
  DshPrepareInstallation,
  DshPreparedRevision,
  DshWorkspaceScope,
} from "./contract.js";
import {
  cloneDshRevision,
  hashDirectory,
  inside,
  readJson,
  safeIdentifier,
  withDirectoryLock,
  writeJson,
} from "./files.js";
import { DSH_HOST_OVERLAY_FILENAME, materializeDshProfile } from "./materialize.js";
import { normalizeDshSource, requireImmutableDshSource } from "./source.js";
import { DshPackageError } from "./errors.js";
import {
  dshDataSchema,
  dshDomainGrantSchema,
  dshDomainRecordSchema,
  dshPreparedRevisionSchema,
  dshRevisionProvenanceSchema,
  dshWorkspaceScopeSchema,
  parseDshStored,
} from "./schemas.js";

export interface DshPackageStoreOptions {
  root: string;
  runtimeVersions: Readonly<Record<string, string>>;
  runtimeDependencyRoot?: string;
  packageCommand?: DshPackageCommand;
  httpsRequest?: DshHttpsRequest;
}

export function dshWorkspaceKey(scope: DshWorkspaceScope): string {
  const parsed = parseDshStored(dshWorkspaceScopeSchema, scope, "workspace scope");
  return parsed.workspaceIdentity?.trim() || parsed.workspacePath;
}

export function createDshPackageStore(options: DshPackageStoreOptions): DshPackageStore {
  return new PackageStore(options);
}

class PackageStore implements DshPackageStore {
  private readonly root: string;
  constructor(private readonly options: DshPackageStoreOptions) {
    if (!isAbsolute(options.root))
      throw new DshPackageError("DSH_INVALID_METADATA", "DSH inventory root must be absolute");
    if (options.runtimeDependencyRoot && !isAbsolute(options.runtimeDependencyRoot))
      throw new DshPackageError("DSH_INVALID_METADATA", "Runtime dependency root must be absolute");
    this.root = resolve(options.root);
  }
  private domainRoot(domainId: string) {
    return join(this.root, "domains", safeIdentifier(domainId, "domain id"));
  }
  private revisionRoot(domainId: string, revision: string) {
    return join(this.domainRoot(domainId), "revisions", safeIdentifier(revision, "revision"));
  }
  private async privatePath(path: string): Promise<void> {
    inside(this.root, relative(this.root, path));
    let cursor = this.root;
    for (const component of relative(this.root, path).split(sep)) {
      cursor = join(cursor, component);
      try {
        if ((await lstat(cursor)).isSymbolicLink())
          throw new DshPackageError(
            "DSH_INVALID_METADATA",
            "Stored package path must not redirect through a symbolic link",
          );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
    }
  }
  private async domainLock<T>(domainId: string, body: () => Promise<T>): Promise<T> {
    // 先验证派生路径再创建锁，避免 symlink 域把 operation-lock 写入其他 owner 的目录。
    await this.privatePath(this.domainRoot(domainId));
    return await withDirectoryLock(this.domainRoot(domainId), body);
  }
  private sameScope(stored: DshWorkspaceScope, scope: DshWorkspaceScope, key: string): void {
    // 同路径并不代表同 owner；revision 自身与 domain 都必须校验 identity 和 remoteSessionId，缺失同样不能越域。
    if (
      dshWorkspaceKey(stored) !== key ||
      key !== dshWorkspaceKey(scope) ||
      stored.remoteSessionId !== scope.remoteSessionId
    ) {
      throw new DshPackageError(
        "DSH_SCOPE_MISMATCH",
        "DSH domain workspace or remote session scope mismatch",
      );
    }
  }
  private async record(domainId: string, scope: DshWorkspaceScope): Promise<DshDomainRecord> {
    await this.privatePath(join(this.domainRoot(domainId), "domain.json"));
    const record = parseDshStored(
      dshDomainRecordSchema,
      await readJson(join(this.domainRoot(domainId), "domain.json")),
      "domain record",
    );
    if (
      record.domainId !== domainId ||
      record.dataDirectory !== join(this.root, "data", domainId)
    ) {
      throw new DshPackageError(
        "DSH_INVALID_METADATA",
        "DSH domain identity or data path mismatch",
      );
    }
    this.sameScope(record.scope, scope, record.workspaceKey);
    return record;
  }
  async list(scope: DshWorkspaceScope): Promise<DshDomainRecord[]> {
    const workspaceKey = dshWorkspaceKey(scope);
    const path = join(this.root, "domains");
    let names: string[];
    try {
      names = await readdir(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const records: DshDomainRecord[] = [];
    for (const name of names.sort()) {
      let raw: DshDomainRecord;
      try {
        await this.privatePath(join(path, name, "domain.json"));
        raw = parseDshStored(
          dshDomainRecordSchema,
          await readJson(join(path, name, "domain.json")),
          "domain record",
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (raw.workspaceKey === workspaceKey && raw.scope.remoteSessionId === scope.remoteSessionId)
        records.push(await this.record(name, scope));
    }
    return records;
  }
  async prepare(input: DshPrepareInstallation): Promise<DshPreparedRevision> {
    return await this.stage(input);
  }
  private async stage(
    input: DshPrepareInstallation,
    expectedRevision?: string,
  ): Promise<DshPreparedRevision> {
    const key = dshWorkspaceKey(input.scope);
    const source = normalizeDshSource(input.source, input.scope.workspacePath);
    requireImmutableDshSource(source);
    const provenance = parseDshStored(
      dshRevisionProvenanceSchema,
      {
        source,
        baseBundles: input.baseBundles ?? [],
        configPatches: input.configPatches ?? [],
      },
      "prepare provenance",
    );
    const configPatches = provenance.configPatches;
    const domainId =
      input.domainId ??
      `dsh-${createHash("sha256")
        .update(
          `${key}\0${input.scope.remoteSessionId ?? ""}\0${source.kind === "npm" ? source.packageName : source.spec}`,
        )
        .digest("hex")
        .slice(0, 24)}`;
    const root = this.domainRoot(domainId);
    await this.privatePath(root);
    return await this.domainLock(domainId, async () => {
      let previous: DshDomainRecord | undefined;
      try {
        previous = await this.record(domainId, input.scope);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (
        expectedRevision &&
        (previous?.preparedRevision ?? previous?.activeRevision) !== expectedRevision
      ) {
        throw new DshPackageError(
          "DSH_LOCKED",
          "Selected update revision changed before command admission",
        );
      }
      const revision = randomUUID();
      const directory = this.revisionRoot(domainId, revision);
      const profileDirectory = join(directory, "profile");
      try {
        input.signal?.throwIfAborted();
        const materialized = await materializeDshProfile({
          source,
          profileDirectory,
          input: { ...input, baseBundles: provenance.baseBundles, configPatches },
          runtimeVersions: this.options.runtimeVersions,
          runtimeDependencyRoot: this.options.runtimeDependencyRoot,
          packageCommand: this.options.packageCommand,
          httpsRequest: this.options.httpsRequest,
        });
        const digest = await hashDirectory(profileDirectory, input.signal);
        const createdAt = new Date().toISOString();
        const prepared = parseDshStored(
          dshPreparedRevisionSchema,
          {
            domainId,
            revision,
            digest,
            workspaceKey: key,
            scope: { ...input.scope },
            profileDirectory,
            packageName: materialized.manifest.name,
            manifest: materialized.manifest,
            source,
            provenance,
            dependencyInventory: materialized.dependencyInventory,
            createdAt,
            state: "awaiting-trust",
          },
          "prepared revision",
        );
        const record = parseDshStored(
          dshDomainRecordSchema,
          {
            domainId,
            workspaceKey: key,
            scope: { ...input.scope },
            ...(previous?.activeRevision ? { activeRevision: previous.activeRevision } : {}),
            ...(previous?.previousRevision ? { previousRevision: previous.previousRevision } : {}),
            preparedRevision: revision,
            enabled: previous?.enabled ?? false,
            revisions: [...(previous?.revisions ?? []), revision],
            updatedAt: createdAt,
            dataDirectory: join(this.root, "data", domainId),
          },
          "prepared domain record",
        );
        // 关闭可能发生在最后一次 hash IO 后；提交 admission 前再次检查，不能发布迟到的 prepared 指针。
        input.signal?.throwIfAborted();
        // 完整候选与引用一起校验后才写入；否则 prepare 可发布下一次读取立即拒绝的记录。
        await writeJson(join(directory, "revision.json"), prepared);
        input.signal?.throwIfAborted();
        await writeJson(join(root, "domain.json"), record);
        return prepared;
      } catch (error) {
        await rm(directory, { recursive: true, force: true });
        if (error instanceof DshPackageError || input.signal?.aborted) throw error;
        throw new DshPackageError(
          "DSH_INSTALL_FAILED",
          `DSH package staging failed: ${error instanceof Error ? error.message : "Invalid package"}`,
          { cause: error },
        );
      }
    });
  }
  async readRevision(
    domainId: string,
    revision: string,
    scope: DshWorkspaceScope,
  ): Promise<DshPreparedRevision> {
    const record = await this.record(domainId, scope);
    if (!record.revisions.includes(revision))
      throw new DshPackageError("DSH_REVISION_UNKNOWN", "Unknown DSH package revision");
    await this.privatePath(join(this.revisionRoot(domainId, revision), "revision.json"));
    const raw = parseDshStored(
      dshPreparedRevisionSchema,
      await readJson(join(this.revisionRoot(domainId, revision), "revision.json")),
      "revision record",
    );
    if (
      raw.domainId !== domainId ||
      raw.revision !== revision ||
      raw.workspaceKey !== record.workspaceKey
    )
      throw new DshPackageError("DSH_SCOPE_MISMATCH", "DSH revision scope mismatch");
    this.sameScope(raw.scope, scope, raw.workspaceKey);
    const expectedProfile = join(this.revisionRoot(domainId, revision), "profile");
    if (
      raw.profileDirectory !== expectedProfile ||
      raw.packageName !== raw.manifest.name ||
      JSON.stringify(raw.source) !== JSON.stringify(raw.provenance.source)
    ) {
      throw new DshPackageError(
        "DSH_INVALID_METADATA",
        "DSH revision profile path or source mismatch",
      );
    }
    await this.privatePath(raw.profileDirectory);
    if (raw.grant && (raw.grant.revision !== raw.revision || raw.grant.digest !== raw.digest))
      throw new DshPackageError("DSH_INVALID_METADATA", "Stored trust does not bind revision");
    return raw;
  }
  async authorize(
    domainId: string,
    grant: DshDomainGrant,
    scope: DshWorkspaceScope,
  ): Promise<DshPreparedRevision> {
    grant = parseDshStored(dshDomainGrantSchema, grant, "domain capability grant");
    return await this.domainLock(domainId, async () => {
      const revision = await this.readRevision(domainId, grant.revision, scope);
      if (grant.digest !== revision.digest)
        throw new DshPackageError(
          "DSH_INTEGRITY_MISMATCH",
          "Trust must bind the exact revision digest",
        );
      if ((await hashDirectory(revision.profileDirectory)) !== revision.digest)
        throw new DshPackageError(
          "DSH_INTEGRITY_MISMATCH",
          "DSH package integrity digest changed before trust",
        );
      const trusted: DshPreparedRevision = {
        ...revision,
        state: "trusted",
        grant: structuredClone(grant),
      };
      await writeJson(
        join(this.revisionRoot(domainId, revision.revision), "revision.json"),
        trusted,
      );
      return trusted;
    });
  }
  async verify(
    domainId: string,
    revisionId: string,
    scope: DshWorkspaceScope,
  ): Promise<DshPreparedRevision> {
    const revision = await this.readRevision(domainId, revisionId, scope);
    if (
      revision.state !== "trusted" ||
      !revision.grant ||
      revision.grant.digest !== revision.digest ||
      revision.grant.revision !== revisionId
    )
      throw new DshPackageError("DSH_AWAITING_TRUST", "DSH package revision is awaiting trust");
    if ((await hashDirectory(revision.profileDirectory)) !== revision.digest)
      throw new DshPackageError("DSH_INTEGRITY_MISMATCH", "DSH package integrity digest mismatch");
    return revision;
  }
  async activate(
    domainId: string,
    revisionId: string,
    scope: DshWorkspaceScope,
  ): Promise<DshDomainRecord> {
    return await this.domainLock(domainId, async () => {
      await this.verify(domainId, revisionId, scope);
      const current = await this.record(domainId, scope);
      const next: DshDomainRecord = {
        ...current,
        activeRevision: revisionId,
        ...(current.activeRevision && current.activeRevision !== revisionId
          ? { previousRevision: current.activeRevision }
          : {}),
        enabled: true,
        updatedAt: new Date().toISOString(),
      };
      delete next.preparedRevision;
      await writeJson(join(this.domainRoot(domainId), "domain.json"), next);
      return next;
    });
  }
  async setEnabled(
    domainId: string,
    enabled: boolean,
    scope: DshWorkspaceScope,
  ): Promise<DshDomainRecord> {
    return await this.domainLock(domainId, async () => {
      const current = await this.record(domainId, scope);
      if (enabled) {
        if (!current.activeRevision)
          throw new DshPackageError(
            "DSH_AWAITING_TRUST",
            "DSH domain has no trusted active revision",
          );
        await this.verify(domainId, current.activeRevision, scope);
      }
      const next = { ...current, enabled, updatedAt: new Date().toISOString() };
      await writeJson(join(this.domainRoot(domainId), "domain.json"), next);
      return next;
    });
  }
  async uninstall(
    domainId: string,
    scope: DshWorkspaceScope,
    options: { deleteData?: boolean } = {},
  ): Promise<void> {
    await this.domainLock(domainId, async () => {
      const record = await this.record(domainId, scope);
      if (record.enabled)
        throw new DshPackageError(
          "DSH_DOMAIN_ENABLED",
          "Stop and disable the DSH domain before uninstalling",
        );
      if (options.deleteData) await this.privatePath(record.dataDirectory);
      await rm(join(this.domainRoot(domainId), "domain.json"));
      await rm(join(this.domainRoot(domainId), "revisions"), { recursive: true, force: true });
      if (options.deleteData) {
        await rm(record.dataDirectory, { recursive: true, force: true });
      }
    });
  }

  async configure(
    domainId: string,
    patches: DshData[],
    scope: DshWorkspaceScope,
  ): Promise<DshPreparedRevision> {
    const parsed = parseDshStored(
      dshDataSchema.array().max(10000),
      patches,
      "configuration patches",
    );
    return await this.domainLock(domainId, async () => {
      const record = await this.record(domainId, scope);
      const selected = record.preparedRevision ?? record.activeRevision;
      if (!selected)
        throw new DshPackageError(
          "DSH_REVISION_UNKNOWN",
          "DSH domain has no existing revision to configure",
        );
      const base = await this.readRevision(domainId, selected, scope);
      const combinedPatches = parseDshStored(
        dshDataSchema.array().max(10000),
        [...base.provenance.configPatches, ...parsed],
        "accumulated configuration patches",
      );
      if ((await hashDirectory(base.profileDirectory)) !== base.digest)
        throw new DshPackageError(
          "DSH_INTEGRITY_MISMATCH",
          "Stored revision integrity changed before configuration",
        );
      const revision = randomUUID();
      const directory = this.revisionRoot(domainId, revision);
      const profileDirectory = join(directory, "profile");
      try {
        await cloneDshRevision(base.profileDirectory, profileDirectory);
        let overlay: DshData[] = [];
        try {
          overlay = parseDshStored(
            dshDataSchema.array().max(10000),
            await readJson(join(profileDirectory, DSH_HOST_OVERLAY_FILENAME)),
            "Host configuration overlay",
          );
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        await writeJson(join(profileDirectory, DSH_HOST_OVERLAY_FILENAME), [...overlay, ...parsed]);
        const digest = await hashDirectory(profileDirectory);
        const createdAt = new Date().toISOString();
        const next: DshPreparedRevision = {
          ...base,
          revision,
          digest,
          profileDirectory,
          createdAt,
          state: "awaiting-trust",
          provenance: {
            ...base.provenance,
            configPatches: combinedPatches,
            configuredFrom: selected,
          },
        };
        delete next.grant;
        const validated = parseDshStored(dshPreparedRevisionSchema, next, "configured revision");
        const nextRecord = parseDshStored(
          dshDomainRecordSchema,
          {
            ...record,
            preparedRevision: revision,
            revisions: [...record.revisions, revision],
            updatedAt: createdAt,
          },
          "configured domain record",
        );
        await writeJson(join(directory, "revision.json"), validated);
        await writeJson(join(this.domainRoot(domainId), "domain.json"), nextRecord);
        return validated;
      } catch (error) {
        await rm(directory, { recursive: true, force: true });
        throw error;
      }
    });
  }

  async update(
    domainId: string,
    scope: DshWorkspaceScope,
    options: { signal?: AbortSignal } = {},
  ): Promise<DshPreparedRevision> {
    const record = await this.record(domainId, scope);
    const selected = record.preparedRevision ?? record.activeRevision;
    if (!selected)
      throw new DshPackageError(
        "DSH_REVISION_UNKNOWN",
        "DSH domain has no declared source to update",
      );
    const previous = await this.readRevision(domainId, selected, scope);
    return await this.stage(
      { ...previous.provenance, domainId, scope, signal: options.signal },
      selected,
    );
  }
}
