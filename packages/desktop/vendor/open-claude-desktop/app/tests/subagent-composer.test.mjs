import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

// The tasks pane's follow-up box for a continuable sub-agent (Thread.canAcceptDirectInput; the DeepSeek bridge sends
// its messages through the subagent service). Server-rendered; effects do not run.
const app = path.resolve(import.meta.dirname, '..');
let server, React, render, pane, agentModel;
before(async () => {
  React = (await import('react')).default;
  ({ renderToStaticMarkup: render } = await import('react-dom/server'));
  const { createServer } = await import('vite'), react = (await import('@vitejs/plugin-react')).default;
  server = await createServer({ configFile: false, root: app, plugins: [react()], server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  pane = await server.ssrLoadModule('/src/source-agent.jsx');
  agentModel = await server.ssrLoadModule('/src/agent-model.mjs');
});
after(() => server?.close());

const spawn = { id: 'spawn-1', type: 'collabAgentToolCall', tool: 'spawnAgent', receiverThreadIds: ['child-1'], agentsStates: { 'child-1': { status: 'completed' } }, description: 'probe child' };
const state = { items: { parent: [spawn], 'child-1': [] }, threads: { 'child-1': { id: 'child-1', parentThreadId: 'parent', canAcceptDirectInput: true } }, active: {}, usage: {}, approvalConnectionEpoch: 1 };
const html = (props) => render(React.createElement(pane.SourceTasksPane, { state, sessionId: 'parent', views: [{ threadId: 'child-1', toolId: 'spawn-1', ownerId: 'parent', description: 'probe child' }],
  onLoad: async () => {}, onBack() {}, onClose() {}, onOpen() {}, renderItem: () => null, ...props }));

test('a continuable sub-agent gets a follow-up box named after it; a one-shot one does not', () => {
  const open = html({ onMessage: async () => {}, canMessage: () => true });
  assert.match(open, /class="sag-composer"/);
  assert.match(open, /placeholder="Message probe child…"/);
  assert.match(open, /aria-label="Send"/);
  assert.doesNotMatch(html({ onMessage: async () => {}, canMessage: () => false }), /sag-composer/);
  assert.doesNotMatch(html({}), /sag-composer/);
});

test('a one-shot refusal reads in the app’s words; other failures keep the core’s message', () => {
  assert.equal(agentModel.subAgentMessageError(new Error('This sub-agent can’t take messages: it ran once and finished. Ask DeepSeek to start a new one.')), 'This sub-agent can’t take messages: it ran once and finished.');
  assert.equal(agentModel.subAgentMessageError(new Error('Connection lost.')), 'Connection lost.');
});
