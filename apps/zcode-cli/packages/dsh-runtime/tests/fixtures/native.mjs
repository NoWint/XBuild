import { appendFile } from 'node:fs/promises';

export const name = 'native-domain-fixture';
export const inject = ['connection'];

export function apply(ctx, config) {
  let incoming;
  const received = message => { if (message.type === 'request' && message.request.kind === 'fetch' && message.request.path === '/api/poison') incoming = message; };
  process.on('message', received);
  ctx.effect(() => () => { process.off('message', received); });
  ctx.connection.fetch.register({
    path: '/api/poison', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => {
      const envelope = { protocolVersion: 1, domainId: incoming.domainId, generation: incoming.generation };
      process.send({ ...envelope, type: 'result', generation: incoming.generation - 1, requestId: incoming.requestId, result: 'stale-generation' });
      process.send({ ...envelope, type: 'result', requestId: incoming.requestId + 10_000, result: 'unknown-id' });
      process.send({ ...envelope, type: 'result', requestId: incoming.requestId, result: 'unknown-fields', unknown: true });
      process.send({ ...envelope, type: 'event', eventSeq: 1_000_000, kind: 'stream', payload: { streamId: 'unknown-stream', event: 'end' } });
      process.send({ ...envelope, type: 'event', eventSeq: 1_000_001, kind: 'notification', payload: { jsonrpc: '1.0', method: 'fabricated' } });
      process.stdout.write('{"type":"result","requestId":1,"result":"stdout-is-not-ipc"}\n');
      return new Response('native-unpoisoned');
    },
  });
  process.stdout.write('plugin stdout is not a protocol\n');
  ctx.effect(() => async () => { await appendFile(config.marker, 'disposed\n'); });
  ctx.connection.fetch.register({
    path: '/api/loader-setting', methods: ['GET'], requestBody: 'buffered',
    fetch: async request => {
      const value = new URL(request.url).searchParams.get('value');
      if (value !== null) await ctx.loader.update('include:setting-fixture', { config: { value } });
      await ctx.loader.await();
      return Response.json(ctx.loader.resolve('include:setting-fixture').options.config);
    },
  });
  ctx.connection.fetch.register({
    path: '/api/fixture', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => Response.json({
      pid: process.pid, cwd: process.cwd(), home: process.env.HOME,
      dshHome: process.env.DSH_HOME, tmp: process.env.TMPDIR,
      secret: process.env.ZCODE_DSH_TEST_SECRET ?? null,
      profile: ctx.profileContext.dir,
    }),
  });
  ctx.connection.fetch.register({
    path: '/api/bytes', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => new Response(new Uint8Array([0, 255, 10, 13, 128]), {
      status: 201, headers: { 'content-type': 'application/octet-stream', 'x-native': 'true' },
    }),
  });
  ctx.connection.fetch.register({
    path: '/api/hang', methods: ['GET'], requestBody: 'buffered',
    fetch: async (request) => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([255, 0]));
        request.signal.addEventListener('abort', () => controller.error(new Error('cancelled-native-stream')), { once: true });
      },
      async cancel() { await appendFile(config.marker, 'stream-cancelled\n'); },
    }), { headers: { 'content-type': 'text/event-stream' } }),
  });
  ctx.connection.fetch.register({
    path: '/api/crash', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => { process.exit(37); },
  });
}
