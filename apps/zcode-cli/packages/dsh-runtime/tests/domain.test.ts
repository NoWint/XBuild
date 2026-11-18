import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { DshDomain, DshDomainEvent, DshDomainStartOptions, DshJson } from '../src/contract.js';

const roots: string[] = [];
const domains: DshDomain[] = [];
const PACKAGE_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));
const TIMEOUT = 30_000;

async function start(options: DshDomainStartOptions): Promise<DshDomain> {
  const entry = await import('../dist/index.js').catch(() => ({}));
  expect(entry).toHaveProperty('startDshDomain', expect.any(Function));
  const domain = await (entry as typeof import('../dist/index.js')).startDshDomain(options);
  domains.push(domain);
  return domain;
}

async function prepared(extra: { sdk?: boolean; ask?: boolean; remote?: boolean; rows?: object[] } = {}): Promise<DshDomainStartOptions & { marker: string }> {
  const root = await mkdtemp(join(tmpdir(), 'zcode-dsh-domain-'));
  roots.push(root);
  const profileDirectory = join(root, 'profile');
  const workspacePath = join(root, 'workspace');
  await Promise.all([mkdir(profileDirectory), mkdir(workspacePath)]);
  const marker = join(root, 'effects.log');
  await writeFile(marker, '');
  const rows: object[] = [
    { id: 'credentials', name: '@deepseek-ai/dsh-credentials-local', config: { watch: false } },
    { id: 'connection', name: '@deepseek-ai/dsh-client-connection' },
    { id: 'native-fixture', name: fileURLToPath(new URL('./fixtures/native.mjs', import.meta.url)), config: { marker } },
    ...(extra.rows ?? []),
  ];
  if (extra.remote) rows.push(
    { id: 'typert', name: '@deepseek-ai/dsh-typert-registry' },
    { id: 'remote-access', name: '@deepseek-ai/dsh-api-remote-access' },
    { id: 'gateway', name: '@deepseek-ai/dsh-api-gateway', config: {} },
    { id: 'remote-fixture', name: fileURLToPath(new URL('./fixtures/remote.mjs', import.meta.url)), config: { marker } },
  );
  if (extra.sdk) {
    rows.push(...[
      ['llm', '@deepseek-ai/dsh-llm'], ['session', '@deepseek-ai/dsh-session'],
      ['session-projection', '@deepseek-ai/dsh-session-projection'], ['system-prompt', '@deepseek-ai/dsh-system-prompt'],
      ['tools', '@deepseek-ai/dsh-tools'], ['tool-executor-native', '@deepseek-ai/dsh-tool-executor-native'],
      ['agent', '@deepseek-ai/dsh-agent'], ['filesystem', '@deepseek-ai/dsh-fs-local'],
      ['working-directory', '@deepseek-ai/dsh-working-directory'], ['approval', '@deepseek-ai/dsh-user-approval'],
      ['agent-loop', '@deepseek-ai/dsh-agent-loop'],
    ].map(([id, name]) => ({ id, name, config: id === 'agent-loop' ? { agents: [] } : {} })));
    rows.push({ id: 'persistence', name: '@deepseek-ai/dsh-session-persistence-jsonl', config: { root: join(root, 'data', 'sessions'), compression: 'none' } });
    rows.push({ id: 'fixture-model', name: fileURLToPath(new URL('./fixtures/model.mjs', import.meta.url)), config: { marker, ask: extra.ask ?? false } });
  }
  await writeFile(join(profileDirectory, 'package.json'), JSON.stringify({ name: 'approved-test-profile', private: true, dsh: { profile: { bundles: [] } } }));
  // JSON is valid YAML, preserving native Profile patch parsing.
  await writeFile(join(profileDirectory, 'cordis.patch.yml'), JSON.stringify([{ insert: rows }]));
  return {
    domainId: basename(root), revision: 'approved-revision', generation: 7,
    workspace: { workspacePath, workspaceIdentity: 'ssh:test:/workspace', remoteSessionId: 'remote-one' },
    profileDirectory, installationAnchor: join(PACKAGE_DIRECTORY, 'package.json'), dataDirectory: join(root, 'data'),
    environment: {}, runner: { executable: process.execPath }, marker,
  };
}

async function body(domain: DshDomain, path: string): Promise<Buffer> {
  const events: DshDomainEvent[] = [];
  const complete = Promise.withResolvers<void>();
  const unsubscribe = domain.subscribe(event => {
    if (event.kind !== 'stream') return;
    events.push(event);
    const payload = event.payload as { event: string };
    if (payload.event === 'end') complete.resolve();
    if (payload.event === 'error') complete.reject(new Error(JSON.stringify(event.payload)));
  });
  try {
    const response = await domain.request({ kind: 'fetch', path }) as { streamId?: string; bodyBase64?: string };
    if (response.streamId === undefined) return Buffer.from(response.bodyBase64 ?? '', 'base64');
    await complete.promise;
    return Buffer.concat(events.flatMap(event => {
      const payload = event.payload as { streamId: string; event: string; chunkBase64?: string };
      return payload.streamId === response.streamId && payload.event === 'chunk' ? [Buffer.from(payload.chunkBase64!, 'base64')] : [];
    }));
  } finally { unsubscribe(); }
}

async function initialize(domain: DshDomain, cwd: string, model = 'normal'): Promise<DshJson> {
  return domain.request({ kind: 'sdk', method: 'initialize', params: { cwd, provider: 'deterministic', model, approvalRequests: true } });
}

async function query(domain: DshDomain, signal?: AbortSignal): Promise<DshJson> {
  return domain.request({ kind: 'sdk', method: 'session/query', params: { sessionId: 'session-fixture', contentBlocks: [{ type: 'text', text: 'use native echo' }] } }, { signal });
}

function killRemaining(pids: number[]): void {
  for (const pid of pids) {
    try { process.kill(pid, 'SIGKILL'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
}

afterEach(async () => {
  await Promise.allSettled(domains.splice(0).map(domain => domain.stop()));
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('real DSH dependency-domain worker', () => {
  it('fails closed on persisted ownership from a vanished supervisor without modifying native data', async () => {
    const options = await prepared();
    await mkdir(options.dataDirectory);
    const marker = join(options.dataDirectory, '.xbuild-domain-owner.json');
    const abandoned = JSON.stringify({ state: 'active', domainId: options.domainId, generation: 6, ownerPid: 2147483647 });
    await writeFile(marker, abandoned);
    await writeFile(join(options.dataDirectory, 'native-data'), 'must-remain');
    await expect(start(options)).rejects.toMatchObject({ code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
    expect(await readFile(marker, 'utf8')).toBe(abandoned);
    expect(await readFile(join(options.dataDirectory, 'native-data'), 'utf8')).toBe('must-remain');
    expect(await readFile(options.marker, 'utf8')).toBe('');
  }, TIMEOUT);

  it.each([
    { mode: 'graceful', detached: false },
    { mode: 'graceful', detached: true },
    { mode: 'timeout', detached: false },
    { mode: 'timeout', detached: true },
    { mode: 'abrupt', detached: false },
    { mode: 'abrupt', detached: true },
    { mode: 'startup-failure', detached: false },
    { mode: 'startup-failure', detached: true },
    { mode: 'graceful', detached: true, reap: true },
    { mode: 'startup-failure', detached: true, reap: true },
  ])('cleans observed real descendants and quarantines unverifiable release: $mode detached=$detached', async scenario => {
    const options = await prepared();
    const pidFile = `${options.marker}.pids`;
    const patches = JSON.parse(await readFile(join(options.profileDirectory, 'cordis.patch.yml'), 'utf8'));
    patches[0].insert.push({
      id: 'descendants', name: fileURLToPath(new URL('./fixtures/descendants.mjs', import.meta.url)),
      config: { pidFile, detached: scenario.detached, reap: scenario.reap ?? false, hang: scenario.mode === 'timeout', failStartup: scenario.mode === 'startup-failure' },
    });
    await writeFile(join(options.profileDirectory, 'cordis.patch.yml'), JSON.stringify(patches));
    options.shutdownTimeoutMs = 100;
    let pids: number[] = [];
    try {
      if (scenario.mode === 'startup-failure') {
        await expect(start(options)).rejects.toMatchObject({
          code: 'DSH_DOMAIN_STARTUP_FAILED',
          ...(scenario.detached && !scenario.reap ? { details: { resourceRelease: 'quarantined' } } : {}),
        });
        pids = JSON.parse(await readFile(pidFile, 'utf8'));
      } else {
        const domain = await start(options);
        pids = JSON.parse(await readFile(pidFile, 'utf8'));
        expect(pids).toHaveLength(2);
        for (const pid of pids) expect(() => process.kill(pid, 0)).not.toThrow();
        if (scenario.mode === 'abrupt') {
          await expect(domain.request({ kind: 'fetch', path: '/api/crash' })).rejects.toMatchObject({ code: 'DSH_DOMAIN_EXITED' });
          await expect(domain.stop()).rejects.toMatchObject({ code: 'DSH_DOMAIN_EXITED' });
        } else if (scenario.mode === 'timeout') await expect(domain.stop()).rejects.toMatchObject({ code: 'DSH_DOMAIN_SHUTDOWN_TIMEOUT' });
        else if (scenario.detached && !scenario.reap) await expect(domain.stop()).rejects.toMatchObject({ code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
        else await domain.stop();
      }
      for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow();
      const quarantined = ['timeout', 'abrupt'].includes(scenario.mode) || (scenario.detached && !scenario.reap);
      if (quarantined) {
        const marker = JSON.parse(await readFile(join(options.dataDirectory, '.xbuild-domain-owner.json'), 'utf8'));
        expect(marker).toMatchObject({ state: 'quarantined', domainId: options.domainId });
        await expect(start({ ...options, domainId: `${options.domainId}-replacement`, generation: 8 })).rejects.toMatchObject({ code: 'DSH_DOMAIN_RESOURCE_QUARANTINED' });
      } else if (scenario.mode === 'startup-failure') {
        await expect(readFile(join(options.dataDirectory, '.xbuild-domain-owner.json'))).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(start({ ...options, generation: 8 })).rejects.toMatchObject({ code: 'DSH_DOMAIN_STARTUP_FAILED' });
        pids = JSON.parse(await readFile(pidFile, 'utf8'));
        for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow();
      } else {
        const replacement = await start({ ...options, generation: 8 });
        await replacement.stop();
      }
    } finally {
      if (!pids.length) pids = JSON.parse(await readFile(pidFile, 'utf8').catch(() => '[]'));
      killRemaining(pids);
    }
  }, TIMEOUT);

  it('rejects a duplicate Remote stream without terminating or losing the incumbent stream', async () => {
    const domain = await start(await prepared({ remote: true }));
    const events: DshDomainEvent[] = [];
    domain.subscribe(event => { if (event.kind === 'stream') events.push(event); });
    await domain.request({ kind: 'peer-open', peerId: 'a', interactions: 'answer' });
    const request = { kind: 'remote-stream', peerId: 'a', streamId: 'incumbent', endpoint: 'fixtureRemote/duplex', payload: { args: {} } } as const;
    const incumbent = domain.invoke(request);
    await incumbent.result;
    const duplicate = domain.invoke(request);
    await expect(duplicate.result).rejects.toMatchObject({ code: 'DSH_DOMAIN_REQUEST_FAILED' });
    await duplicate.settled;
    await domain.request({ kind: 'stream-uplink', peerId: 'a', streamId: 'incumbent', value: { survives: true } });
    await domain.request({ kind: 'stream-uplink', peerId: 'a', streamId: 'incumbent', end: true });
    await incumbent.settled;
    expect(events.some(event => (event.payload as { event: string }).event === 'error')).toBe(false);
    expect(events.map(event => event.payload)).toEqual(expect.arrayContaining([{ peerId: 'a', streamId: 'incumbent', event: 'data', value: { survives: true } }]));
    const cancellable = domain.invoke({ ...request, streamId: 'cancellable' });
    await cancellable.result;
    const rejected = domain.invoke({ ...request, streamId: 'cancellable' });
    await expect(rejected.result).rejects.toMatchObject({ code: 'DSH_DOMAIN_REQUEST_FAILED' });
    await rejected.settled;
    cancellable.cancel();
    await cancellable.settled;
    expect(events.filter(event => (event.payload as { streamId: string; event: string }).streamId === 'cancellable' && (event.payload as { event: string }).event === 'error')).toHaveLength(1);
  }, TIMEOUT);
  it('persists original UI-style Loader setting changes across approved Profile restarts', async () => {
    const options = await prepared({ rows: [
      { id: 'setting-fixture', name: fileURLToPath(new URL('./fixtures/setting.mjs', import.meta.url)), config: { value: 'original' } },
    ] });
    const before = await readFile(join(options.profileDirectory, 'cordis.patch.yml'), 'utf8');
    const first = await start(options);
    expect(JSON.parse((await body(first, '/api/loader-setting?value=changed')).toString())).toEqual({ value: 'changed' });
    await first.stop();
    expect(await readFile(join(options.profileDirectory, 'cordis.patch.yml'), 'utf8')).toBe(before);
    const second = await start({ ...options, generation: 8 });
    expect(JSON.parse((await body(second, '/api/loader-setting')).toString())).toEqual({ value: 'changed' });
  }, TIMEOUT);
  // 回归：域持久化层曾以「叠加自身后的结果」为基线，重启后 diff 恒为空，关闭时把用户配置写成 []。
  // 该层只记录相对授权组合的增量，并在多次重启后保持稳定（不自反馈、不累积）。
  it('keeps the domain loader-state layer idempotent across repeated restarts', async () => {
    const options = await prepared({ rows: [
      { id: 'setting-fixture', name: fileURLToPath(new URL('./fixtures/setting.mjs', import.meta.url)), config: { value: 'original' } },
    ] });
    const statePath = join(options.dataDirectory, 'loader-state.json');
    const first = await start(options);
    expect(JSON.parse((await body(first, '/api/loader-setting?value=changed')).toString())).toEqual({ value: 'changed' });
    await first.stop();
    const persisted = JSON.parse(await readFile(statePath, 'utf8')) as { id: string; config?: unknown }[];
    expect(persisted).toEqual([{ id: 'setting-fixture', config: { value: 'changed' } }]);
    // 第二次启动只重读该层；关闭后必须保持同一份增量字节。
    const second = await start({ ...options, generation: 8 });
    expect(JSON.parse((await body(second, '/api/loader-setting')).toString())).toEqual({ value: 'changed' });
    await second.stop();
    expect(JSON.parse(await readFile(statePath, 'utf8'))).toEqual(persisted);
    // 第三次再核对，排除一次性收敛或 diff 累积。
    const third = await start({ ...options, generation: 9 });
    expect(JSON.parse((await body(third, '/api/loader-setting')).toString())).toEqual({ value: 'changed' });
    await third.stop();
    expect(JSON.parse(await readFile(statePath, 'utf8'))).toEqual(persisted);
  }, TIMEOUT);
  it('keeps command receipts cancellable and owned through original session.query.completed activity', async () => {
    const options = await prepared({ sdk: true, ask: true, rows: [
      { id: 'commands', name: '@deepseek-ai/dsh-commands' },
      { id: 'plan-mode', name: '@deepseek-ai/dsh-plan-mode', config: { section: 'Plan before executing.' } },
    ] });
    const domain = await start(options);
    await initialize(domain, options.workspace.workspacePath);
    const asked = Promise.withResolvers<void>();
    const answer = Promise.withResolvers<DshJson>();
    const notifications: DshDomainEvent[] = [];
    domain.subscribe(event => { if (event.kind === 'notification') notifications.push(event); });
    const call = domain.invoke({ kind: 'sdk', method: 'session/query', params: { sessionId: 'session-fixture', contentBlocks: [{ type: 'text', text: '/plan use tool' }] } }, {
      onHostRequest: async () => { asked.resolve(); return answer.promise; },
    });
    const receipt = await call.result as { execution: { commandId: string } };
    expect(receipt).toMatchObject({ kind: 'command', execution: { commandId: expect.any(String) } });
    let settled = false;
    void call.settled.then(() => { settled = true; });
    await body(domain, '/api/model-started');
    expect(settled).toBe(false);
    await asked.promise;
    answer.resolve({ outcome: 'allowed-once' });
    await call.settled;
    expect(notifications).toEqual(expect.arrayContaining([expect.objectContaining({ payload: expect.objectContaining({ method: 'session.query.completed', params: expect.objectContaining({ commandId: receipt.execution.commandId }) }) })]));
    expect(await readFile(options.marker, 'utf8')).toContain('tool-body\n');
  }, TIMEOUT);

  it('cancels the original command-admitted Agent after receipt and awaits native unwind', async () => {
    const options = await prepared({ sdk: true, rows: [
      { id: 'commands', name: '@deepseek-ai/dsh-commands' },
      { id: 'plan-mode', name: '@deepseek-ai/dsh-plan-mode', config: { section: 'Plan before executing.' } },
    ] });
    const domain = await start(options);
    await initialize(domain, options.workspace.workspacePath, 'hang');
    const call = domain.invoke({ kind: 'sdk', method: 'session/query', params: { sessionId: 'session-fixture', contentBlocks: [{ type: 'text', text: '/plan wait' }] } });
    expect(await call.result).toMatchObject({ kind: 'command' });
    await body(domain, '/api/model-started');
    call.cancel();
    await call.settled;
    expect(await readFile(options.marker, 'utf8')).toContain('model-cancelled\n');
  }, TIMEOUT);

  it('fails a bounded uplink with the native overflow code and unwinds its iterator', async () => {
    const options = await prepared({ remote: true });
    const domain = await start(options);
    const events: DshDomainEvent[] = [];
    domain.subscribe(event => { if (event.kind === 'stream') events.push(event); });
    await domain.request({ kind: 'peer-open', peerId: 'a', interactions: 'answer' });
    const call = domain.invoke({ kind: 'remote-stream', peerId: 'a', streamId: 'blocked', endpoint: 'fixtureRemote/blocked', payload: { args: {} } });
    await call.result;
    await expect(domain.request({ kind: 'stream-uplink', peerId: 'a', streamId: 'blocked', value: 'x'.repeat(262_145) })).rejects.toMatchObject({ code: 'DSH_DOMAIN_REQUEST_FAILED' });
    await call.settled;
    expect(events.at(-1)?.payload).toMatchObject({ peerId: 'a', event: 'error', error: { code: 'gateway/uplink-overflow' } });
    expect(await readFile(options.marker, 'utf8')).toContain('remote-disposed:');
  }, TIMEOUT);

  it('loads a validated Host-owned last overlay without changing the approved Profile', async () => {
    const options = await prepared();
    const before = await readFile(join(options.profileDirectory, 'cordis.patch.yml'), 'utf8');
    await writeFile(join(options.profileDirectory, '.xbuild-host-overlay.json'), JSON.stringify([{ id: 'native-fixture', disabled: true }]));
    const domain = await start(options);
    expect(await domain.request({ kind: 'plugins' })).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'native-fixture', state: 'disabled' })]));
    expect(await readFile(join(options.profileDirectory, 'cordis.patch.yml'), 'utf8')).toBe(before);
  }, TIMEOUT);

  it.each(['{}', '[null]', '[{"id":"native-fixture","config":{"invalid":NaN}}]'])('rejects malformed Host-owned overlay before original boot: %s', async overlay => {
    const options = await prepared();
    await writeFile(join(options.profileDirectory, '.xbuild-host-overlay.json'), overlay);
    await expect(start(options)).rejects.toMatchObject({ code: 'DSH_DOMAIN_STARTUP_FAILED' });
    expect(await readFile(options.marker, 'utf8')).toBe('');
  }, TIMEOUT);
  it('opens real Gateway duplex streams with isolated Peer scopes, undefined values and uplink half-close', async () => {
    const options = await prepared({ remote: true });
    const domain = await start(options);
    const events: DshDomainEvent[] = [];
    domain.subscribe(event => { if (event.kind === 'stream') events.push(event); });
    await domain.request({ kind: 'peer-open', peerId: 'a', interactions: 'answer' });
    await domain.request({ kind: 'peer-open', peerId: 'b', interactions: 'none' });
    const unary = async (peerId: string) => {
      const call = domain.invoke({ kind: 'fetch', peerId, path: '/api/fixtureRemote/identity', method: 'POST', headers: { 'content-type': 'application/json' }, bodyBase64: Buffer.from(JSON.stringify({ type: 'client-request', rpcId: 'identity', method: 'fixtureRemote/identity', payload: { args: {} } })).toString('base64') });
      await call.result;
      await call.settled;
      const bytes = Buffer.concat(events.flatMap(event => {
        const payload = event.payload as { event: string; chunkBase64?: string };
        return payload.event === 'chunk' ? [Buffer.from(payload.chunkBase64!, 'base64')] : [];
      }));
      events.length = 0;
      return JSON.parse(bytes.toString()).result.value;
    };
    const first = await unary('a');
    const second = await unary('b');
    expect(first.peer).not.toBe(second.peer);
    expect(first.interactions).toBe('answer');
    expect(second.interactions).toBe('none');
    const stream = domain.invoke({ kind: 'remote-stream', peerId: 'a', streamId: 'duplex', endpoint: 'fixtureRemote/duplex', payload: { args: {} } });
    expect(await stream.result).toEqual({ peerId: 'a', streamId: 'duplex' });
    await domain.request({ kind: 'stream-uplink', peerId: 'a', streamId: 'duplex', value: { echoed: 42 } });
    await domain.request({ kind: 'stream-uplink', peerId: 'a', streamId: 'duplex', end: true });
    await stream.settled;
    expect(events.map(event => event.payload)).toEqual([
      { peerId: 'a', streamId: 'duplex', event: 'data', value: { ready: first.peer } },
      { peerId: 'a', streamId: 'duplex', event: 'data' },
      { peerId: 'a', streamId: 'duplex', event: 'data', value: { echoed: 42 } },
      { peerId: 'a', streamId: 'duplex', event: 'data', value: { halfClosed: true } },
      { peerId: 'a', streamId: 'duplex', event: 'end' },
    ]);
    await domain.request({ kind: 'peer-close', peerId: 'a' });
    expect(await readFile(options.marker, 'utf8')).toContain(`peer-disposed:${first.peer}\n`);
    expect((await unary('b')).peer).toBe(second.peer);
  }, TIMEOUT);

  it('preserves original Remote failures and settles cancellation and Peer cleanup without touching another Peer', async () => {
    const options = await prepared({ remote: true });
    const domain = await start(options);
    const events: DshDomainEvent[] = [];
    domain.subscribe(event => { if (event.kind === 'stream') events.push(event); });
    for (const peerId of ['a', 'b']) await domain.request({ kind: 'peer-open', peerId, interactions: 'answer' });
    const failing = domain.invoke({ kind: 'remote-stream', peerId: 'a', streamId: 'failing', endpoint: 'fixtureRemote/duplex', payload: { args: {} } });
    await failing.result;
    await domain.request({ kind: 'stream-uplink', peerId: 'a', streamId: 'failing', value: 'fail' });
    await failing.settled;
    expect(events.at(-1)?.payload).toEqual({ peerId: 'a', streamId: 'failing', event: 'error', error: { code: 'fixture/failure', message: 'native stream failed', details: { native: true } } });
    const blocked = domain.invoke({ kind: 'remote-stream', peerId: 'a', streamId: 'blocked', endpoint: 'fixtureRemote/blocked', payload: { args: {} } });
    await blocked.result;
    blocked.cancel();
    await blocked.settled;
    expect(events.at(-1)?.payload).toMatchObject({ peerId: 'a', streamId: 'blocked', event: 'error', error: { code: 'gateway/cancelled' } });
    const attached = domain.invoke({ kind: 'remote-stream', peerId: 'a', streamId: 'shared', endpoint: 'fixtureRemote/blocked', payload: { args: {} } });
    await attached.result;
    const other = domain.invoke({ kind: 'remote-stream', peerId: 'b', streamId: 'shared', endpoint: 'fixtureRemote/duplex', payload: { args: {} } });
    await other.result;
    await domain.request({ kind: 'peer-close', peerId: 'a' });
    await attached.settled;
    expect(events.map(event => event.payload)).toEqual(expect.arrayContaining([expect.objectContaining({ peerId: 'a', streamId: 'shared', event: 'error' })]));
    expect(events.some(event => {
      const payload = event.payload as { peerId?: string; event?: string };
      return payload.peerId === 'b' && payload.event === 'error';
    })).toBe(false);
    await domain.request({ kind: 'stream-uplink', peerId: 'b', streamId: 'shared', value: { stillLive: true } });
    await domain.request({ kind: 'stream-uplink', peerId: 'b', streamId: 'shared', end: true });
    await other.settled;
    await domain.stop();
    expect(domain.info.state).toBe('stopped');
    expect((await readFile(options.marker, 'utf8')).match(/remote-disposed:/g)).toHaveLength(4);
  }, TIMEOUT);

  it('exposes separate prompt receipt and native settlement with per-invocation approval ownership', async () => {
    const options = await prepared({ sdk: true, ask: true });
    const domain = await start(options);
    await initialize(domain, options.workspace.workspacePath);
    const asked = Promise.withResolvers<void>();
    const answer = Promise.withResolvers<DshJson>();
    const call = domain.invoke({ kind: 'sdk', method: 'session/query', params: { sessionId: 'session-fixture', contentBlocks: [{ type: 'text', text: 'use tool' }] } }, {
      onHostRequest: async () => { asked.resolve(); return answer.promise; },
    });
    expect(await call.result).toMatchObject({ kind: 'prompt' });
    let settled = false;
    void call.settled.then(() => { settled = true; });
    await asked.promise;
    expect(settled).toBe(false);
    answer.resolve({ outcome: 'allowed-once' });
    await call.settled;
    expect(await readFile(options.marker, 'utf8')).toContain('tool-body\n');
  }, TIMEOUT);
  it('boots the real Cordis tree in a separate scoped process without inherited secrets', async () => {
    const options = await prepared();
    process.env.ZCODE_DSH_TEST_SECRET = 'must-not-inherit';
    try {
      const domain = await start(options);
      const response = JSON.parse((await body(domain, '/api/fixture')).toString());
      expect(response).toMatchObject({ pid: domain.info.pid, cwd: await realpath(options.workspace.workspacePath), dshHome: options.dataDirectory, secret: null, profile: options.profileDirectory });
      expect(response.pid).not.toBe(process.pid);
      expect(response.home).not.toBe(process.env.HOME);
      expect(domain.info).toMatchObject({ generation: 7, state: 'running', workspace: options.workspace, runtimeVersion: '0.2.2-rc.3' });
      expect(await domain.request({ kind: 'plugins' })).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'native-fixture', state: 'active' })]));
    } finally { delete process.env.ZCODE_DSH_TEST_SECRET; }
  }, TIMEOUT);

  it('ignores stale-generation, unknown ids, nested schema drift and stdout lookalike frames in a real child', async () => {
    const domain = await start(await prepared());
    const events: DshDomainEvent[] = [];
    domain.subscribe(event => events.push(event));
    expect((await body(domain, '/api/poison')).toString()).toBe('native-unpoisoned');
    expect(await body(domain, '/api/bytes')).toEqual(Buffer.from([0, 255, 10, 13, 128]));
    expect(events.filter(event => event.kind === 'notification')).toEqual([]);
    expect(events.filter(event => event.kind === 'stream').map(event => (event.payload as { streamId: string }).streamId)).not.toContain('unknown-stream');
    for (let index = 1; index < events.length; index++) expect(events[index]!.sequence - events[index - 1]!.sequence).toBe(1);
  }, TIMEOUT);

  it('keeps the approved revision Profile byte-for-byte immutable while booting a domain-owned root', async () => {
    const options = await prepared();
    await writeFile(join(options.profileDirectory, 'cordis.yml'), '# immutable approved root\n[]\n');
    const before = await Promise.all((await readdir(options.profileDirectory)).map(async file => [file, await readFile(join(options.profileDirectory, file), 'utf8')]));
    const domain = await start(options);
    await domain.stop();
    const after = await Promise.all((await readdir(options.profileDirectory)).map(async file => [file, await readFile(join(options.profileDirectory, file), 'utf8')]));
    expect(after).toEqual(before);
  }, TIMEOUT);

  it('preserves Profile-local package resolution when the mutable Include root lives in domain data', async () => {
    const options = await prepared();
    const packageDir = join(options.profileDirectory, 'node_modules', 'approved-local-plugin');
    await mkdir(packageDir, { recursive: true });
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: 'approved-local-plugin', version: '1.0.0', type: 'module', main: './index.mjs' }));
    await writeFile(join(packageDir, 'index.mjs'), `export const name = 'approved-local-plugin'; export const inject = ['connection']; export function apply(ctx) { ctx.connection.fetch.register({ path: '/api/local', methods: ['GET'], requestBody: 'buffered', fetch: async () => Response.json({ source: 'approved-local-plugin', baseUrl: ctx.baseUrl }) }); }`);
    await writeFile(join(options.profileDirectory, 'package.json'), JSON.stringify({ name: 'approved-local-profile', private: true, dependencies: { 'approved-local-plugin': '1.0.0' }, dsh: { profile: { bundles: [] } } }));
    const patches = JSON.parse(await readFile(join(options.profileDirectory, 'cordis.patch.yml'), 'utf8'));
    patches[0].insert.push({ id: 'local-plugin', name: 'approved-local-plugin' });
    await writeFile(join(options.profileDirectory, 'cordis.patch.yml'), JSON.stringify(patches));
    const domain = await start(options);
    expect(JSON.parse((await body(domain, '/api/local')).toString())).toMatchObject({ source: 'approved-local-plugin' });
    expect(await domain.request({ kind: 'plugins' })).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'local-plugin', state: 'active' })]));
  }, TIMEOUT);

  it('awaits original async fiber disposal and process exit with idempotent stop', async () => {
    const options = await prepared();
    const domain = await start(options);
    await Promise.all([domain.stop(), domain.stop()]);
    expect(domain.info.state).toBe('stopped');
    expect(await readFile(options.marker, 'utf8')).toContain('disposed\n');
    expect(() => process.kill(domain.info.pid!, 0)).toThrow();
    await expect(domain.request({ kind: 'plugins' })).rejects.toMatchObject({ code: 'DSH_DOMAIN_STOPPED' });
  }, TIMEOUT);

  it('does not report successful stop when the original Cordis disposer rejects', async () => {
    const options = await prepared({ rows: [{ id: 'cleanup-outcome', name: fileURLToPath(new URL('./fixtures/disposal.mjs', import.meta.url)), config: {} }] });
    const domain = await start(options);
    await expect(domain.stop()).rejects.toMatchObject({ code: 'DSH_DOMAIN_SHUTDOWN_FAILED' });
    expect(domain.info.state).toBe('failed');
    expect(() => process.kill(domain.info.pid!, 0)).toThrow();
  }, TIMEOUT);

  it('confirms process exit after terminating an unresponsive original disposer', async () => {
    const options = await prepared({ rows: [{ id: 'cleanup-outcome', name: fileURLToPath(new URL('./fixtures/disposal.mjs', import.meta.url)), config: { hang: true } }] });
    options.shutdownTimeoutMs = 100;
    const domain = await start(options);
    await expect(domain.stop()).rejects.toMatchObject({ code: 'DSH_DOMAIN_SHUTDOWN_TIMEOUT' });
    expect(domain.info.state).toBe('failed');
    expect(() => process.kill(domain.info.pid!, 0)).toThrow();
  }, TIMEOUT);

  it('does not coalesce two remote identities sharing the same workspace path', async () => {
    const firstOptions = await prepared();
    const secondOptions = await prepared();
    secondOptions.workspace = { ...firstOptions.workspace, workspaceIdentity: 'ssh:other:/workspace', remoteSessionId: 'remote-two' };
    secondOptions.domainId = firstOptions.domainId;
    const first = await start(firstOptions);
    const second = await start(secondOptions);
    expect(first.info.pid).not.toBe(second.info.pid);
    const firstBody = JSON.parse((await body(first, '/api/fixture')).toString());
    const secondBody = JSON.parse((await body(second, '/api/fixture')).toString());
    expect(firstBody.dshHome).not.toBe(secondBody.dshHome);
    await first.stop();
    expect(await body(second, '/api/bytes')).toEqual(Buffer.from([0, 255, 10, 13, 128]));
  }, TIMEOUT);

  it.each([
    { id: 'broken-plugin', name: './missing-enabled-plugin.mjs' },
    { id: 'pending-plugin', name: fileURLToPath(new URL('./fixtures/native.mjs', import.meta.url)), inject: ['never-provided'] },
  ])('rejects incomplete activation of enabled $id instead of warning and succeeding', async row => {
    const options = await prepared({ rows: [row] });
    await expect(start(options)).rejects.toMatchObject({ code: 'DSH_DOMAIN_STARTUP_FAILED' });
    expect(await readFile(options.marker, 'utf8')).toContain('disposed\n');
  }, TIMEOUT);

  it('rejects a selected missing Bundle rather than silently starting an empty replacement profile', async () => {
    const options = await prepared();
    await writeFile(join(options.profileDirectory, 'package.json'), JSON.stringify({ name: 'missing-bundle-profile', dsh: { profile: { bundles: ['not-installed-bundle'] } } }));
    await expect(start(options)).rejects.toMatchObject({ code: 'DSH_DOMAIN_STARTUP_FAILED' });
  }, TIMEOUT);

  it('preserves raw non-UTF8 Fetch bytes and closes streams on the caller AbortSignal', async () => {
    const options = await prepared();
    const domain = await start(options);
    expect(await body(domain, '/api/bytes')).toEqual(Buffer.from([0, 255, 10, 13, 128]));
    const controller = new AbortController();
    const chunks: DshDomainEvent[] = [];
    const terminal = Promise.withResolvers<void>();
    domain.subscribe(event => {
      if (event.kind !== 'stream') return;
      chunks.push(event);
      if ((event.payload as { event: string }).event === 'error') terminal.resolve();
    });
    const result = await domain.request({ kind: 'fetch', path: '/api/hang' }, { signal: controller.signal });
    expect(result).toMatchObject({ status: 200, streamId: expect.any(String) });
    controller.abort();
    await terminal.promise;
    expect(chunks).toEqual(expect.arrayContaining([expect.objectContaining({ payload: expect.objectContaining({ event: 'error' }) })]));
  }, TIMEOUT);

  it('rejects pending work on abrupt child exit and observes the nonzero exit code', async () => {
    const options = await prepared();
    const domain = await start(options);
    const exits: DshDomainEvent[] = [];
    domain.subscribe(event => { if (event.kind === 'exit') exits.push(event); });
    await expect(domain.request({ kind: 'fetch', path: '/api/crash' })).rejects.toMatchObject({ code: 'DSH_DOMAIN_EXITED' });
    expect(domain.info.state).toBe('failed');
    expect(exits[0]?.payload).toMatchObject({ code: 37 });
  }, TIMEOUT);

  it('runs the original SDK deterministic model turn through native pre/post Tool hooks and persistence', async () => {
    const options = await prepared({ sdk: true });
    const domain = await start(options);
    const notifications: DshDomainEvent[] = [];
    domain.subscribe(event => { if (event.kind === 'notification') notifications.push(event); });
    expect(await initialize(domain, options.workspace.workspacePath)).toMatchObject({ serverInfo: { name: 'deepseek-harness-sdk-runtime' } });
    const result = await query(domain);
    expect(result).toMatchObject({ kind: 'prompt', messageId: expect.any(String) });
    expect(await domain.request({ kind: 'sdk', method: 'session/wait', params: { sessionId: 'session-fixture' } })).toEqual({});
    const effects = await readFile(options.marker, 'utf8');
    expect(effects).toContain('pre:native_echo\ntool-body\npost:native_echo\n');
    expect(notifications).toEqual(expect.arrayContaining([expect.objectContaining({ payload: expect.objectContaining({ jsonrpc: '2.0', method: 'session.event', params: expect.objectContaining({ sessionId: 'session-fixture' }) }) })]));
    await domain.stop();
    const root = join(options.dataDirectory, 'sessions');
    const files = (await readdir(root, { recursive: true })).filter(file => file.endsWith('.jsonl'));
    expect(files.length).toBeGreaterThan(0);
    const persistence = (await Promise.all(files.map(file => readFile(join(root, file), 'utf8')))).join('\n');
    expect(persistence).toContain('native complete');
    expect(persistence).toContain('native_echo');
  }, TIMEOUT);

  it('maps the exact native stdio SDK row to IPC without changing the approved Profile or exit owner', async () => {
    const options = await prepared({ sdk: true, rows: [{ id: 'sdk-jsonrpc-server', name: '@deepseek-ai/dsh-sdk-jsonrpc-server', inject: ['loader'], config: { maxTokensAsSuccess: true } }] });
    const profileBefore = await readFile(join(options.profileDirectory, 'cordis.patch.yml'), 'utf8');
    const domain = await start(options);
    const logs: DshDomainEvent[] = [];
    domain.subscribe(event => { if (event.kind === 'log') logs.push(event); });
    expect(await initialize(domain, options.workspace.workspacePath)).toMatchObject({ serverInfo: { name: 'deepseek-harness-sdk-runtime' } });
    await query(domain);
    expect(await domain.request({ kind: 'sdk', method: 'session/wait', params: { sessionId: 'session-fixture' } })).toEqual({});
    expect(domain.info.state).toBe('running');
    expect(logs.some(event => JSON.stringify(event.payload).includes('"jsonrpc"'))).toBe(false);
    await domain.stop();
    expect(domain.info.state).toBe('stopped');
    expect(await readFile(join(options.profileDirectory, 'cordis.patch.yml'), 'utf8')).toBe(profileBefore);
  }, TIMEOUT);

  it('uses actual Agent.cancel when a deterministic model is aborted, not a nonexistent SDK method', async () => {
    const options = await prepared({ sdk: true });
    const domain = await start(options);
    await initialize(domain, options.workspace.workspacePath, 'hang');
    await query(domain);
    expect(await body(domain, '/api/model-started')).toEqual(Buffer.from('started'));
    const controller = new AbortController();
    const pending = domain.request({ kind: 'sdk', method: 'session/wait', params: { sessionId: 'session-fixture' } }, { signal: controller.signal });
    const rejected = pending.catch(error => error);
    controller.abort();
    expect(await rejected).toMatchObject({ code: 'DSH_DOMAIN_CANCELLED' });
    await domain.stop();
    expect(await readFile(options.marker, 'utf8')).toContain('model-cancelled\n');
  }, TIMEOUT);

  it('keeps a prompt receipt AbortSignal bound until the original native Agent reaches idle', async () => {
    const options = await prepared({ sdk: true });
    const domain = await start(options);
    await initialize(domain, options.workspace.workspacePath, 'hang');
    const controller = new AbortController();
    expect(await query(domain, controller.signal)).toMatchObject({ kind: 'prompt' });
    expect(await body(domain, '/api/model-started')).toEqual(Buffer.from('started'));
    controller.abort();
    await domain.request({ kind: 'sdk', method: 'session/wait', params: { sessionId: 'session-fixture' } });
    expect(await readFile(options.marker, 'utf8')).toContain('model-cancelled\n');
  }, TIMEOUT);

  it('does not abort another Session host approval when cancelling one invocation', async () => {
    const options = await prepared({ sdk: true, ask: true });
    const ready = Promise.withResolvers<void>();
    const approvals = new Map<string, { signal: AbortSignal; release(): void }>();
    options.onHostRequest = async (_method, params, { signal }) => {
      const sessionId = (params as { sessionId: string }).sessionId;
      const answer = Promise.withResolvers<void>();
      approvals.set(sessionId, { signal, release: () => answer.resolve() });
      if (approvals.size === 2) ready.resolve();
      await answer.promise;
      return { outcome: 'allowed-once' };
    };
    const domain = await start(options);
    await initialize(domain, options.workspace.workspacePath);
    for (const sessionId of ['session-a', 'session-b']) {
      await domain.request({ kind: 'sdk', method: 'session/query', params: { sessionId, contentBlocks: [{ type: 'text', text: 'use tool' }] } });
    }
    await ready.promise;
    const controller = new AbortController();
    const waitA = domain.request({ kind: 'sdk', method: 'session/wait', params: { sessionId: 'session-a' } }, { signal: controller.signal }).catch(error => error);
    controller.abort();
    expect(await waitA).toMatchObject({ code: 'DSH_DOMAIN_CANCELLED' });
    expect(approvals.get('session-b')!.signal.aborted).toBe(false);
    approvals.get('session-b')!.release();
    await domain.request({ kind: 'sdk', method: 'session/wait', params: { sessionId: 'session-b' } });
    expect(await readFile(options.marker, 'utf8')).toContain('tool-body\n');
  }, TIMEOUT);

  it('roundtrips native approval to the host owner and does not execute when denied', async () => {
    const options = await prepared({ sdk: true, ask: true });
    const approvals: string[] = [];
    options.onHostRequest = async method => { approvals.push(method); return { outcome: 'rejected' }; };
    const domain = await start(options);
    await initialize(domain, options.workspace.workspacePath);
    await query(domain);
    await domain.request({ kind: 'sdk', method: 'session/wait', params: { sessionId: 'session-fixture' } });
    expect(approvals).toEqual(['approval/request']);
    expect(await readFile(options.marker, 'utf8')).not.toContain('tool-body\n');
  }, TIMEOUT);
});
