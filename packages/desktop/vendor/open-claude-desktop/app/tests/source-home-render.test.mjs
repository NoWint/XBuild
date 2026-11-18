import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

let server, Home, Context, sourceRoutine, RoutineTemplate, templates;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  ({ TD: Home } = await server.ssrLoadModule('/src/generated/chat/shared-24-C4QZCHDk.js'));
  ({ CoworkHomeContext: Context } = await server.ssrLoadModule('/src/source-home-adapters.jsx'));
  ({ sourceRoutine } = await server.ssrLoadModule('/src/source-routine-adapters.jsx'));
  ({ fo: RoutineTemplate, co: templates } = await server.ssrLoadModule('/src/generated/chat/ccd3f68fe-JzfLnZNI.js'));
  (await server.ssrLoadModule('/electron/i18n/index.mjs')).setLocale('en-US');
});
after(() => server?.close());

const task = (id, patch = {}) => ({ id, name: id, cron: '0 9 * * *', enabled: true,
  nextRunAt: new Date('2030-01-01T09:00:00Z').getTime(), options: { model: 'test', permission: 'ask' }, ...patch });
const render = tasks => renderToStaticMarkup(React.createElement(Context.Provider, { value: {
  rows: [], readState: { initializedAt: 0, sessions: {} }, ready: true, attentionIds: new Set(), permissions: new Map(),
  scheduledTasks: tasks.map(sourceRoutine), onOpen() {}, onOpenRoutine() {},
} }, React.createElement(Home, { emptyFallback: React.createElement('p', null, 'Ideas fallback') })));

test('original home consumes local schedules, orders enabled tasks by next run and folds after three', () => {
  const html = render([task('Paused', { enabled: false, nextRunAt: null }),
    task('Later', { nextRunAt: new Date('2030-01-02T09:00:00Z').getTime() }), task('Sooner'),
    task('Last', { nextRunAt: new Date('2030-01-03T09:00:00Z').getTime() })]);
  assert.match(html, /Scheduled/);
  assert.equal((html.match(/href="\/scheduled-task\//g) ?? []).length, 3);
  assert.ok(html.indexOf('>Sooner<') < html.indexOf('>Later<'));
  assert.ok(html.indexOf('>Later<') < html.indexOf('>Last<'));
  assert.doesNotMatch(html, />Paused</);
  assert.match(html, /Show more/);
  assert.doesNotMatch(html, /Ideas fallback/);
});

test('paused schedules retain the original row and route, including encoded IDs', () => {
  const html = render([task('review / 每周', { enabled: false, nextRunAt: null })]);
  assert.match(html, /href="\/scheduled-task\/review%20%2F%20%E6%AF%8F%E5%91%A8"/);
  assert.match(html, /review \/ 每周/);
  assert.doesNotMatch(html, /Invalid Date|Show more/);
});

test('one-time schedules remain excluded from the recurring home section as in the source', () => {
  const html = render([task('One time', { cron: null, fireAt: Date.now() + 60000 })]);
  assert.match(html, /Ideas fallback/);
  assert.doesNotMatch(html, /scheduled-task|One time/);
});

test('all six original schedule starters render their illustration, description and schedule', () => {
  assert.equal(templates.length, 6);
  for (const template of templates) {
    const html = renderToStaticMarkup(React.createElement(RoutineTemplate, { template, onSelect() {} }));
    assert.match(html, /<button/);
    assert.match(html, /data-cds="Icon"/);
    assert.match(html, /8:00|9:00|4:00/);
    assert.doesNotMatch(html, /undefined|\[object Object\]/);
  }
});
