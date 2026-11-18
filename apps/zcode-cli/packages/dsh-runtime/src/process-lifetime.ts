import { execFile, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { DshDomainError } from './ipc.js';

const execute = promisify(execFile);
export const PROCESS_VERIFICATION_MS = 5000;
interface ProcessIdentity { pid: number; parent: number; group: number; start: string; state: string }
export interface ProcessRelease { verified: boolean; escapedIntervention: boolean; diagnostic?: string }

export function assertProcessLifetimePlatform(platform: string = process.platform): void {
  if (platform !== 'darwin' && platform !== 'linux') {
    throw new DshDomainError('DSH_DOMAIN_PLATFORM_UNSUPPORTED', `Native process ownership is unsupported on ${platform}; Windows requires an implemented Job Object lifetime adapter`);
  }
}

async function processes(): Promise<ProcessIdentity[]> {
  const { stdout } = await execute('/bin/ps', ['-axo', 'pid=,ppid=,pgid=,stat=,lstart='], {
    env: { LC_ALL: 'C' }, maxBuffer: 8 * 1024 * 1024, timeout: PROCESS_VERIFICATION_MS,
  });
  return stdout.trim().split('\n').filter(Boolean).map(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/.exec(line);
    if (!match) throw new Error('Platform process identity output could not be validated');
    return { pid: Number(match[1]), parent: Number(match[2]), group: Number(match[3]), state: match[4]!, start: match[5]! };
  });
}

/** Observed POSIX resources, not containment of arbitrary detached/native code. */
export class ProcessLifetime {
  private readonly identities = new Map<number, ProcessIdentity>();
  private observation: Promise<ProcessIdentity[]> = Promise.resolve([]);
  private rootIdentity?: ProcessIdentity;
  private observationFailure?: Error;
  private termination?: Promise<void>;

  constructor(private readonly child: ChildProcess) {}

  async observe(): Promise<ProcessIdentity[]> {
    const task = this.observation.catch(() => []).then(async () => {
      const rows = await processes();
      const root = rows.find(row => row.pid === this.child.pid);
      if (!this.rootIdentity && root) {
        if (root.group !== root.pid) throw new Error('Worker did not acquire its dedicated process group');
        this.rootIdentity = root;
        this.identities.set(root.pid, root);
      }
      const live = new Map(rows.map(row => [row.pid, row]));
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of rows) {
          if (this.identities.has(row.pid)) continue;
          const parent = this.identities.get(row.parent);
          const currentParent = live.get(row.parent);
          const descended = parent && currentParent?.start === parent.start;
          const grouped = this.rootIdentity && live.get(this.rootIdentity.pid)?.start === this.rootIdentity.start && row.group === this.rootIdentity.group;
          if (descended || grouped) { this.identities.set(row.pid, row); changed = true; }
        }
      }
      return rows;
    });
    this.observation = task;
    try { return await task; }
    catch (error) { this.observationFailure ??= error instanceof Error ? error : new Error(String(error)); throw error; }
  }

  terminate(): Promise<void> {
    this.termination ??= (async () => {
      try { await this.observe(); } catch { /* Root is still ours; unknown descendants remain quarantined. */ }
      this.child.kill('SIGKILL');
    })();
    return this.termination;
  }

  async release(): Promise<ProcessRelease> {
    const deadline = Date.now() + PROCESS_VERIFICATION_MS;
    let escapedIntervention = false;
    try {
      while (true) {
        const rows = await this.observe();
        const remaining = rows.filter(row => {
          const owned = this.identities.get(row.pid);
          return owned?.start === row.start;
        });
        if (remaining.length === 0) {
          if (rows.some(row => row.group === this.rootIdentity?.group)) {
            return { verified: false, escapedIntervention, diagnostic: 'Worker group still contains processes without verified creation identities' };
          }
          return { verified: !this.observationFailure && (this.rootIdentity !== undefined || this.child.pid === undefined), escapedIntervention,
            ...(this.observationFailure ? { diagnostic: this.observationFailure.message } : {}) };
        }
        if (Date.now() >= deadline) return { verified: false, escapedIntervention, diagnostic: 'Observed native resources did not disappear before cleanup verification bound' };
        if (this.rootIdentity && remaining.some(row => row.group === this.rootIdentity!.group)) {
          // 已验证成员证明组仍由本次启动持有；组信号同时终止尚未出现在快照中的普通 fork。
          try { process.kill(-this.rootIdentity.group, 'SIGKILL'); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
        }
        for (const row of remaining) {
          if (row.group !== this.rootIdentity?.group) escapedIntervention = true;
          // start identity 防止仅按已复用 PID 杀进程；ESRCH 只意味着等待下一次实际观测确认。
          try { process.kill(row.pid, 'SIGKILL'); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
        }
        await delay(20);
      }
    } catch (error) {
      return { verified: false, escapedIntervention, diagnostic: error instanceof Error ? error.message : String(error) };
    }
  }
}
