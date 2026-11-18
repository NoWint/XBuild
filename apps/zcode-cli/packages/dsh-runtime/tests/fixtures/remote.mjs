import { appendFile } from 'node:fs/promises';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';

const initializers = [];
class FixtureRemote extends TypertRemoteService {
  constructor(ctx, marker) {
    super(ctx, 'fixtureRemote');
    this.marker = marker;
    for (const initialize of initializers) initialize.call(this);
  }
  async identity() {
    const peer = this.ctx.invocation.peer;
    peer.ctx.effect(() => () => appendFile(this.marker, `peer-disposed:${peer.id}\n`));
    return { peer: peer.id, interactions: peer.interactions };
  }
  async *duplex() {
    const { peer, signal } = this.ctx.invocation;
    try {
      yield { ready: peer.id };
      yield undefined;
      for await (const value of this.ctx.invocation.uplink()) {
        signal.throwIfAborted();
        if (value === 'fail') throw new RemoteError('fixture/failure', 'native stream failed', { native: true });
        yield value;
      }
      yield { halfClosed: true };
    } finally { await appendFile(this.marker, `remote-disposed:${peer.id}\n`); }
  }
  async *blocked() {
    const { peer, signal } = this.ctx.invocation;
    try {
      yield { ready: peer.id };
      await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
      signal.throwIfAborted();
    } finally { await appendFile(this.marker, `remote-disposed:${peer.id}\n`); }
  }
}
for (const name of ['identity', 'duplex', 'blocked']) {
  const context = { kind: 'method', name, static: false, private: false, addInitializer: initialize => initializers.push(initialize) };
  if (name === 'identity') Remote(FixtureRemote.prototype[name], context);
  else Remote({ mode: 'stream' })(FixtureRemote.prototype[name], context);
}
export const inject = ['typertGateway'];
export function apply(ctx, config) { return new FixtureRemote(ctx, config.marker); }
