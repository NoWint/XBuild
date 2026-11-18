// Cross-cutting fixes, round 4, rendered: a ZCode run card's deliverables, open questions, stall and Configure; the
// transcript's question / stall / settings notices; Qwen's MCP App note.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

let server, W, S, G;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  W = await server.ssrLoadModule('/src/source-workflow.jsx');
  S = await server.ssrLoadModule('/src/source-session.jsx');
  G = await server.ssrLoadModule('/src/source-generic-tool.jsx');
});
after(() => server?.close());

const run = {
  id: 'dwfrun-1', runId: 'dwfrun-1', source: 'model', status: 'running', name: 'review', description: 'review', startedAt: Date.now() - 5000, sequence: 3,
  workflowProgress: [{ type: 'workflow_agent', index: 1, id: 'ask#1@0', label: 'checker', state: 'progress', question: 'Threshold 94?' }],
  usage: { totalTokens: 10 }, stall: { sinceMs: 1260000, at: Date.now() },
  pendingQuestions: [{ qid: 'q1', agent: 'checker', question: 'Should the threshold be 94?', context: 'Two tests fail at 96.', askedAt: Date.now() - 60000 }],
  artifacts: [{ id: 'perf', kind: 'table', version: 1, title: 'Timings' }, { id: 'report', kind: 'markdown', version: 2, title: 'Review', primary: true }],
  maxConcurrency: 4, concurrencyCeiling: 8,
};

test('a running ZCode run card shows its stall, open questions, deliverables (primary first) and Configure', () => {
  const html = renderToStaticMarkup(React.createElement(W.WorkflowCard, { run, onStop: () => {}, onArtifact: async () => ({}), onSettings: async () => {}, models: [] }));
  assert.match(html, /data-stall=""[\s\S]*Waiting for the model provider · 21m \d+s/);
  assert.match(html, /Questions waiting for an answer[\s\S]*checker asks[\s\S]*Should the threshold be 94\?[\s\S]*Two tests fail at 96\./);
  assert.match(html, /Waiting for an answer/);
  assert.ok(html.indexOf('Review') < html.indexOf('Timings'), 'the primary deliverable leads');
  assert.match(html, /Main result · Version 2/);
  assert.match(html, /Configure…/);
  const settled = renderToStaticMarkup(React.createElement(W.WorkflowCard, { run: { ...run, status: 'completed' }, onArtifact: async () => ({}), onSettings: async () => {} }));
  assert.doesNotMatch(settled, /Configure…|Questions waiting|Waiting for the model provider/);
  assert.match(settled, /Deliverables/, 'deliverables stay after the run ends');
  const withoutReader = renderToStaticMarkup(React.createElement(W.WorkflowCard, { run }));
  assert.doesNotMatch(withoutReader, /Deliverables|Configure…/, 'only a core that serves them');
});

const notice = (fields) => ({ type: 'userMessage', id: 'n1', content: [], workflowNotification: fields });
test('transcript notices: an agent\'s question opens its text; a stall and a settings change are one line', () => {
  const question = renderToStaticMarkup(React.createElement(S.SourceMessage, { item: notice({ kind: 'escalation', status: 'question', workflow: 'review', agent: 'checker', question: '94 or 96?', context: 'ctx' }) }));
  assert.match(question, /<details[^>]*data-task-event-status="question"[\s\S]*checker in review has a question[\s\S]*94 or 96\?[\s\S]*ctx/);
  const stall = renderToStaticMarkup(React.createElement(S.SourceMessage, { item: notice({ kind: 'stall', status: 'stalled', workflow: 'review', stalledMs: 1260000 }) }));
  assert.match(stall, /review is waiting for the model provider[\s\S]*no reply for 21m/);
  const settings = renderToStaticMarkup(React.createElement(S.SourceMessage, { item: notice({ kind: 'settings', status: 'changed', workflow: 'review' }) }));
  assert.match(settings, /Changed the workflow’s settings[\s\S]*review/);
});

test('an MCP App result says its interactive view isn\'t shown', () => {
  const item = { type: 'mcpToolCall', id: 'm1', server: 'chart', tool: 'show_chart', status: 'completed', arguments: {}, result: { content: [{ type: 'text', text: 'Chart of sales' }] }, error: null, codeDesktop: { mcpApp: { serverName: 'chart', resourceUri: 'ui://chart/app.html' } } };
  const html = renderToStaticMarkup(React.createElement(G.SourceGenericToolBody, { item, state: 'done' }));
  assert.match(html, /Chart of sales[\s\S]*data-mcp-app=""[\s\S]*interactive view/);
});

test('Settings › Dynamic workflows lists saved workflows under their own row', async () => {
  const L = await server.ssrLoadModule('/src/source-saved-workflows.jsx');
  assert.match(renderToStaticMarkup(React.createElement(L.SavedWorkflowsList, { desktopCall: async () => [], cwd: null })), /Open a project to see its saved workflows\./);
  const SW = await server.ssrLoadModule('/src/source-settings-workflows.jsx');
  const config = { dynamicWorkflows: true };
  const group = SW.workflowSettingsGroup({ config, boot: { connected: true, config }, engine: 'zcode', shownValue: (key, value) => value, save: () => {}, models: [], advanced: false, setAdvanced: () => {}, desktopCall: async () => [], cwd: '/p' });
  assert.ok(group.rows.some((row) => row.id === 'workflowSaved' && row.below));
  const without = SW.workflowSettingsGroup({ config, boot: { connected: true, config }, engine: 'zcode', shownValue: (key, value) => value, save: () => {}, models: [], advanced: false, setAdvanced: () => {} });
  assert.equal(without.rows.some((row) => row.id === 'workflowSaved'), false);
});

test('Customize › Agents offers Create agent and Delete only on a core that writes agent files', async () => {
  const C = await server.ssrLoadModule('/src/source-customize.jsx');
  const rows = [{ name: 'build', scope: 'builtin', description: 'Default' }, { name: 'reviewer', scope: 'project', path: '/p/.opencode/agents/reviewer.md', removable: true }];
  const store = { getSnapshot: () => ({ agents: { cwd: '/p', rows } }), subscribe: () => () => {}, loadAgents: () => {}, writeAgent: async () => {}, removeAgent: async () => {} };
  const html = renderToStaticMarkup(React.createElement(C.AgentsSection, { store, cwd: '/p', copy: { name: 'OpenCode', agentsWrite: true }, onRevealPath: () => {} }));
  assert.match(html, /Create agent/);
  assert.equal((html.match(/aria-label="Delete reviewer"/g) || []).length, 1);
  assert.doesNotMatch(html, /Delete build/);
  const readOnly = renderToStaticMarkup(React.createElement(C.AgentsSection, { store, cwd: '/p', copy: { name: 'Qwen' }, onRevealPath: () => {} }));
  assert.doesNotMatch(readOnly, /Create agent|aria-label="Delete/);
});
