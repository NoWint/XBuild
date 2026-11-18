import { appendFile } from 'node:fs/promises';
import { LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm';

export const name = 'deterministic-native-model';
export const inject = ['llm', 'tools', 'connection'];

export function apply(ctx, config) {
  let started;
  const modelStarted = new Promise(resolve => { started = resolve; });
  ctx.connection.fetch.register({ path: '/api/model-started', methods: ['GET'], requestBody: 'buffered', fetch: async () => { await modelStarted; return new Response('started'); } });
  class DeterministicAdapter extends LlmAdapter {
    resolveModel(provider, model) { return Promise.resolve({ provider, id: model, name: model }); }
    async *stream(options) {
      await appendFile(config.marker, `model:${options.model}\n`);
      started();
      if (options.model === 'hang') {
        yield { type: 'block-start', index: 0, blockType: 'text' };
        yield { type: 'text-delta', index: 0, text: 'waiting' };
        await new Promise((resolve, reject) => {
          const aborted = async () => {
            await appendFile(config.marker, 'model-cancelled\n');
            reject(options.signal.reason);
          };
          if (options.signal.aborted) void aborted();
          else options.signal.addEventListener('abort', aborted, { once: true });
        });
        return;
      }
      const alreadyCalled = options.messages.some(message => message.role === 'tool');
      if (!alreadyCalled) {
        const id = ToolCallId('native-call');
        yield { type: 'block-start', index: 0, blockType: 'tool-call' };
        yield { type: 'tool-call-delta', index: 0, id, name: 'native_echo', argumentsDelta: '{"value":"native"}' };
        yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name: 'native_echo', arguments: '{"value":"native"}' } };
        yield { type: 'finish', reason: { kind: 'tool-calls' } };
        return;
      }
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'text-delta', index: 0, text: 'native complete' };
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'native complete' } };
      yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 3 } };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }
  ctx.llm.registerAdapter(['deterministic'], new DeterministicAdapter());
  ctx.tools.register({
    name: 'native_echo', description: 'Echo a value through the native tool pipeline',
    parameters: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args) { await appendFile(config.marker, 'tool-body\n'); return args.value; },
  });
  ctx.on('tools/pre-execute', async (exec, next) => {
    await appendFile(config.marker, `pre:${exec.name}\n`);
    return config.ask ? { kind: 'ask', reason: 'fixture approval' } : next();
  });
  ctx.on('tools/post-execute', async (exec, result, next) => {
    await appendFile(config.marker, `post:${exec.name}\n`);
    return next();
  });
}
