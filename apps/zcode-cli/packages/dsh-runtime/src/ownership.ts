import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, realpath, rename, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { z } from 'zod';
import type { DshDataMaintenanceOptions, DshDomainStartOptions } from './contract.js';
import { DshDomainError, workspaceSchema } from './ipc.js';

const RECORD_BYTES = 64 * 1024;
const owners = new Map<string, DataOwnership>();
const homes = new Map<string, DataOwnership>();
const text = z.string().min(1);
const optionsSchema = z.strictObject({ domainId: text, workspace: workspaceSchema, dataDirectory: text });
const recordBase = {
  version: z.literal(1), token: z.uuid(), domainId: text, workspaceIdentity: text,
  dataDirectory: text, ownerPid: z.number().int().positive(),
};
const recordSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...recordBase, kind: z.literal('native'), state: z.enum(['active', 'quarantined']),
    generation: z.number().int().positive(), reason: z.literal('unverified-native-release').optional() }),
  z.strictObject({ ...recordBase, kind: z.literal('maintenance'), state: z.literal('active') }),
]);
type OwnershipRecord = z.infer<typeof recordSchema>;

function blocked(): DshDomainError {
  return new DshDomainError('DSH_DOMAIN_RESOURCE_QUARANTINED', 'Native data ownership could not be verified; data reuse remains blocked');
}

async function readRecordBytes(path: string): Promise<Buffer | undefined> {
  let file;
  try { file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw blocked(); }
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size > RECORD_BYTES) throw blocked();
    // fstat 先拒绝超限；不使用 readFile 让插件提供的元数据控制父进程分配大小。
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const read = await file.read(bytes, offset, bytes.length - offset, offset);
      if (read.bytesRead === 0) throw blocked();
      offset += read.bytesRead;
    }
    const after = await file.stat();
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw blocked();
    return bytes;
  } catch { throw blocked(); }
  finally { await file.close(); }
}

async function readRecord(path: string): Promise<OwnershipRecord> {
  try {
    const bytes = await readRecordBytes(path);
    if (!bytes) throw blocked();
    const parsed = recordSchema.safeParse(JSON.parse(bytes.toString('utf8')));
    if (!parsed.success) throw blocked();
    return parsed.data;
  } catch { throw blocked(); }
}

async function canonicalData(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw blocked();
    // 只准备 data 的父目录；data 自身必须在外部守卫取得后才创建。
    await mkdir(dirname(path), { recursive: true });
    return join(await realpath(dirname(path)), basename(path));
  }
}

async function writeRecord(path: string, bytes: string): Promise<void> {
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); }
  finally { await file.close(); }
}

/** Reuse protection only: unrestricted trusted code can modify metadata outside its data. */
export class DataOwnership {
  private readonly token = randomUUID();
  private quarantined = false;
  private markerCreated = false;
  private readonly identity: string;
  private readonly guard: string;

  private constructor(private readonly key: string, private readonly directory: string,
    private readonly options: DshDataMaintenanceOptions, private readonly generation?: number) {
    this.identity = options.workspace.workspaceIdentity?.trim() || options.workspace.workspacePath;
    const digest = createHash('sha256').update(directory).digest('hex');
    this.guard = join(dirname(directory), `.xbuild-dsh-lifetime-${digest}.json`);
  }

  static acquire(options: DshDomainStartOptions): Promise<DataOwnership> {
    return DataOwnership.claim(options, options.generation);
  }

  static acquireMaintenance(options: DshDataMaintenanceOptions): Promise<DataOwnership> {
    return DataOwnership.claim(options);
  }

  private static async claim(options: DshDataMaintenanceOptions, generation?: number): Promise<DataOwnership> {
    const parsed = optionsSchema.safeParse({ domainId: options.domainId, workspace: options.workspace, dataDirectory: options.dataDirectory });
    if (!parsed.success || !isAbsolute(options.dataDirectory) || !isAbsolute(options.workspace.workspacePath)) {
      throw new DshDomainError('DSH_DOMAIN_INVALID_OPTIONS', 'Valid domain/workspace identity and absolute data path are required');
    }
    const directory = await canonicalData(options.dataDirectory);
    const identity = options.workspace.workspaceIdentity?.trim() || options.workspace.workspacePath;
    const key = JSON.stringify([options.domainId, identity]);
    const prior = owners.get(key) ?? homes.get(directory);
    if (prior) throw new DshDomainError(prior.quarantined ? 'DSH_DOMAIN_RESOURCE_QUARANTINED' : 'DSH_DOMAIN_CONFLICT', 'Previous native resources still own this domain or data');
    const owner = new DataOwnership(key, directory, parsed.data, generation);
    const bytes = owner.record('active');
    owners.set(key, owner);
    homes.set(directory, owner);
    try { await writeRecord(owner.guard, bytes); }
    catch (error) {
      owner.forget();
      // 其他进程的有效／损坏守卫一律保留；读检查有界且不解释 PID 存活为恢复许可。
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') await readRecord(owner.guard);
      throw blocked();
    }
    try {
      // 旧目录内记录即使没有外部守卫也禁止复用，不能由维护操作抹掉。
      if (await readRecordBytes(owner.marker) !== undefined) throw blocked();
      if (generation !== undefined) {
        await mkdir(directory, { recursive: true });
        const file = await open(owner.marker, 'wx', 0o600);
        owner.markerCreated = true;
        try { await file.writeFile(bytes); await file.sync(); }
        finally { await file.close(); }
      }
      return owner;
    } catch {
      try {
        if (owner.markerCreated) await owner.quarantine('unverified-native-release');
        else await owner.release();
      } catch { /* Unknown records remain guarded rather than being reset. */ }
      throw blocked();
    }
  }

  async release(): Promise<void> {
    try {
      if (this.quarantined) throw blocked();
      await this.owned(this.guard);
      if (this.markerCreated) await this.owned(this.marker);
      // 先验证所有自身记录，随后只删除自身 token 的 marker 和外部守卫。
      if (this.markerCreated) await unlink(this.marker);
      await unlink(this.guard);
      this.forget();
    } catch { this.quarantined = true; throw blocked(); }
  }

  async quarantine(_reason: string): Promise<void> {
    this.quarantined = true;
    try {
      await this.owned(this.guard, true);
      await this.replace(this.guard, this.record('quarantined'));
      if (this.markerCreated) {
        await this.owned(this.marker, true);
        await this.replace(this.marker, this.record('quarantined'));
      }
    } catch { throw blocked(); }
  }

  private async owned(path: string, allowQuarantined = false): Promise<void> {
    const record = await readRecord(path);
    if (record.token !== this.token || record.domainId !== this.options.domainId
      || record.workspaceIdentity !== this.identity || record.dataDirectory !== this.directory
      || record.ownerPid !== process.pid || (!allowQuarantined && record.state !== 'active')
      || (this.generation === undefined ? record.kind !== 'maintenance'
        : record.kind !== 'native' || record.generation !== this.generation)) throw blocked();
  }

  private async replace(path: string, bytes: string): Promise<void> {
    const temporary = `${path}.${this.token}.tmp`;
    try { await writeRecord(temporary, bytes); await rename(temporary, path); }
    finally { await unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw blocked(); }); }
  }

  private get marker(): string { return join(this.directory, '.xbuild-domain-owner.json'); }

  private record(state: 'active' | 'quarantined'): string {
    const base = { version: 1, token: this.token, domainId: this.options.domainId,
      workspaceIdentity: this.identity, dataDirectory: this.directory, ownerPid: process.pid };
    const record = this.generation === undefined ? { ...base, kind: 'maintenance', state: 'active' }
      : { ...base, kind: 'native', state, generation: this.generation, ...(state === 'quarantined' ? { reason: 'unverified-native-release' } : {}) };
    const bytes = JSON.stringify(record);
    if (Buffer.byteLength(bytes) > RECORD_BYTES || !recordSchema.safeParse(record).success) {
      throw new DshDomainError('DSH_DOMAIN_INVALID_OPTIONS', 'Native ownership metadata exceeds its validated bound');
    }
    return bytes;
  }

  private forget(): void {
    if (owners.get(this.key) === this) owners.delete(this.key);
    if (homes.get(this.directory) === this) homes.delete(this.directory);
  }
}

export async function withDshDataMaintenance<T>(options: DshDataMaintenanceOptions, action: () => Promise<T>): Promise<T> {
  if (typeof action !== 'function') throw new DshDomainError('DSH_DOMAIN_INVALID_OPTIONS', 'An awaited data maintenance action is required');
  const owner = await DataOwnership.acquireMaintenance(options);
  try { return await action(); }
  finally { await owner.release(); }
}
