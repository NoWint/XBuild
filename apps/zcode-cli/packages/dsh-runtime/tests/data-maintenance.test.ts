import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import type { DshDomain, DshDomainStartOptions } from '../src/contract.js';

const roots: string[] = [];
const domains: DshDomain[] = [];
const children: ChildProcess[] = [];
const TIMEOUT = 30_000;

async function entry() {
  const runtime = await import('../dist/index.js');
  expect(runtime).toHaveProperty('withDshDataMaintenance', expect.any(Function));
  return runtime;
}

async function prepared(failing = false): Promise<DshDomainStartOptions> {
  const root = await mkdtemp(join(tmpdir(), 'zcode-dsh-maintenance-'));
  roots.push(root);
  const profileDirectory = join(root, 'profile');
  const workspacePath = join(root, 'workspace');
  await Promise.all([mkdir(profileDirectory), mkdir(workspacePath)]);
  const rows = [
    { id: 'credentials', name: '@deepseek-ai/dsh-credentials-local', config: { watch: false } },
    { id: 'connection', name: '@deepseek-ai/dsh-client-connection' },
    { id: 'fixture', name: fileURLToPath(new URL('./fixtures/native.mjs', import.meta.url)), config: { marker: join(root, 'effects.log') } },
    ...(failing ? [{ id: 'failure', name: fileURLToPath(new URL('./fixtures/disposal.mjs', import.meta.url)), config: {} }] : []),
  ];
  await writeFile(join(root, 'effects.log'), '');
  await writeFile(join(profileDirectory, 'package.json'), JSON.stringify({ name: 'maintenance-fixture', private: true, dsh: { profile: { bundles: [] } } }));
  await writeFile(join(profileDirectory, 'cordis.patch.yml'), JSON.stringify([{ insert: rows }]));
  return {
    domainId: basename(root), revision: 'approved', generation: 1,
    workspace: { workspacePath, workspaceIdentity: 'ssh:test:/maintenance' },
    profileDirectory, installationAnchor: fileURLToPath(new URL('../package.json', import.meta.url)),
    dataDirectory: join(root, 'data'), environment: {}, runner: { executable: process.execPath },
  };
}

async function start(options: DshDomainStartOptions) {
  const runtime = await import('../dist/index.js');
  const domain = await runtime.startDshDomain(options);
  domains.push(domain);
  return domain;
}

async function guard(options: DshDomainStartOptions): Promise<string> {
  const root = join(options.dataDirectory, '..');
  const files = await readdir(root);
  const guards = files.filter(file => file.startsWith('.xbuild-dsh-lifetime-') && file.endsWith('.json'));
  expect(guards).toHaveLength(1);
  return join(root, guards[0]!);
}

function probe(mode: 'start' | 'maintenance' | 'hold', options: DshDomainStartOptions) {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/maintenance-probe.mjs', import.meta.url))], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  children.push(child);
  const held = Promise.withResolvers<void>();
  const result = Promise.withResolvers<{ kind: string; code?: string; message?: string }>();
  const exited = Promise.withResolvers<void>();
  child.once('exit', () => exited.resolve());
  child.once('error', error => { result.reject(error); held.reject(error); });
  child.on('message', value => {
    const message = value as { kind: string; code?: string; message?: string };
    if (message.kind === 'held') held.resolve();
    else { result.resolve(message); if (message.kind === 'error') held.reject(new Error(message.message)); }
  });
  void held.promise.catch(() => {});
  child.send({ mode, options });
  return { held: held.promise, result: result.promise, exited: exited.promise, release: () => child.send({ release: true }) };
}

afterEach(async () => {
  await Promise.allSettled(domains.splice(0).map(domain => domain.stop()));
  await Promise.all(children.splice(0).map(child => new Promise<void>(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
    child.once('exit', () => resolve());
    child.kill('SIGKILL');
  })));
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

it('blocks maintenance from erasing a real native cleanup quarantine, including a fresh process', async () => {
  const options = await prepared(true);
  const domain = await start(options);
  await expect(domain.stop()).rejects.toMatchObject({ code: 'DSH_DOMAIN_SHUTDOWN_FAILED' });
  const marker = join(options.dataDirectory, '.xbuild-domain-owner.json');
  const before = await readFile(marker);
  const runtime = await entry();
  await expect(runtime.withDshDataMaintenance(options, () => rm(options.dataDirectory, { recursive: true, force: true }))).rejects.toMatchObject({ code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
  const fresh = probe('maintenance', options);
  expect(await fresh.result).toMatchObject({ kind: 'error', code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
  await fresh.exited;
  expect(await readFile(marker)).toEqual(before);
}, TIMEOUT);

it('preserves an abandoned legacy marker and original data when no external guard exists', async () => {
  const options = await prepared();
  await mkdir(options.dataDirectory);
  const marker = join(options.dataDirectory, '.xbuild-domain-owner.json');
  const legacy = '{"state":"active","ownerPid":2147483647,"private":"never-expose"}';
  await writeFile(marker, legacy);
  await writeFile(join(options.dataDirectory, 'native-data'), 'preserved');
  const runtime = await entry();
  const failure = await runtime.withDshDataMaintenance(options, () => rm(options.dataDirectory, { recursive: true, force: true })).catch(error => error);
  expect(failure).toMatchObject({ code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
  expect(failure.message).not.toContain('never-expose');
  expect(await readFile(marker, 'utf8')).toBe(legacy);
  expect(await readFile(join(options.dataDirectory, 'native-data'), 'utf8')).toBe('preserved');
}, TIMEOUT);

it('holds an external cross-process guard through deletion and all remaining awaited maintenance', async () => {
  const options = await prepared();
  await mkdir(options.dataDirectory);
  await writeFile(join(options.dataDirectory, 'native-data'), 'delete-me');
  await entry();
  const maintenance = probe('hold', options);
  await maintenance.held;
  await expect(readFile(join(options.dataDirectory, 'native-data'))).rejects.toMatchObject({ code: 'ENOENT' });
  expect((await readFile(await guard(options), 'utf8')).length).toBeLessThanOrEqual(65536);
  await expect(start(options)).rejects.toMatchObject({ code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
  await expect(readdir(options.dataDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
  const alias = join(options.dataDirectory, '..', 'alias');
  await symlink(join(options.dataDirectory, '..'), alias, 'dir');
  await expect(start({ ...options, dataDirectory: join(alias, 'data') })).rejects.toMatchObject({ code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
  const competing = probe('maintenance', options);
  expect(await competing.result).toMatchObject({ kind: 'error', code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
  await competing.exited;
  maintenance.release();
  expect(await maintenance.result).toEqual({ kind: 'done' });
  await maintenance.exited;
  const domain = await start(options);
  await domain.stop();
}, TIMEOUT);

it('blocks fresh maintenance and native starts while an original real domain is running', async () => {
  const options = await prepared();
  const domain = await start(options);
  await entry();
  const before = await readFile(join(options.dataDirectory, '.xbuild-domain-owner.json'));
  for (const mode of ['start', 'maintenance'] as const) {
    const fresh = probe(mode, options);
    expect(await fresh.result).toMatchObject({ kind: 'error', code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
    await fresh.exited;
  }
  expect(await readFile(join(options.dataDirectory, '.xbuild-domain-owner.json'))).toEqual(before);
  await domain.stop();
}, TIMEOUT);

it('releases only its maintenance lease after a failed real filesystem action', async () => {
  const options = await prepared();
  await mkdir(options.dataDirectory);
  await writeFile(join(options.dataDirectory, 'native-data'), 'retained');
  const runtime = await entry();
  await expect(runtime.withDshDataMaintenance(options, () => rename(join(options.dataDirectory, 'missing'), join(options.dataDirectory, 'target')))).rejects.toMatchObject({ code: 'ENOENT' });
  const value = await runtime.withDshDataMaintenance(options, async () => {
    const bytes = await readFile(join(options.dataDirectory, 'native-data'), 'utf8');
    await rm(options.dataDirectory, { recursive: true });
    return bytes;
  });
  expect(value).toBe('retained');
  await expect(readdir(options.dataDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
  const domain = await start(options);
  await domain.stop();
}, TIMEOUT);

it.each(['{not-json:private-credential}', 'private-credential'.repeat(4000)])('preserves malformed or oversized native ownership without exposing contents (%#)', async poisoned => {
  const options = await prepared();
  const domain = await start(options);
  const marker = join(options.dataDirectory, '.xbuild-domain-owner.json');
  await writeFile(marker, poisoned);
  const failure = await domain.stop().catch(error => error);
  expect(failure).toMatchObject({ code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
  expect(JSON.stringify({ message: failure.message, details: failure.details })).not.toContain('private-credential');
  expect((await readFile(marker)).equals(Buffer.from(poisoned))).toBe(true);
  const runtime = await entry();
  await expect(runtime.withDshDataMaintenance(options, () => rm(options.dataDirectory, { recursive: true }))).rejects.toMatchObject({ code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
}, TIMEOUT);

it('rejects serialized ownership larger than 64 KiB before writing a guard or creating data', async () => {
  const options = await prepared();
  const runtime = await entry();
  await expect(runtime.withDshDataMaintenance({ ...options, domainId: 'x'.repeat(65536) }, () => writeFile(join(options.dataDirectory, '..', 'must-not-exist'), 'wrong'))).rejects.toMatchObject({ code: 'DSH_DOMAIN_INVALID_OPTIONS' });
  await expect(readdir(options.dataDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
  expect((await readdir(join(options.dataDirectory, '..'))).some(file => file.startsWith('.xbuild-dsh-lifetime-'))).toBe(false);
  await expect(readFile(join(options.dataDirectory, '..', 'must-not-exist'))).rejects.toMatchObject({ code: 'ENOENT' });
}, TIMEOUT);

it('refuses to release or reset a changed external maintenance token', async () => {
  const options = await prepared();
  const runtime = await entry();
  const held = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const action = runtime.withDshDataMaintenance(options, async () => {
    held.resolve();
    await finish.promise;
    await writeFile(join(options.dataDirectory, '..', 'filesystem-finished'), 'done');
  });
  await held.promise;
  const path = await guard(options);
  const record = JSON.parse(await readFile(path, 'utf8'));
  record.token = '11111111-1111-4111-8111-111111111111';
  const changed = JSON.stringify(record);
  await writeFile(path, changed);
  finish.resolve();
  await expect(action).rejects.toMatchObject({ code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
  expect(await readFile(path, 'utf8')).toBe(changed);
  expect(await readFile(join(options.dataDirectory, '..', 'filesystem-finished'), 'utf8')).toBe('done');
  await expect(start(options)).rejects.toMatchObject({ code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
}, TIMEOUT);
