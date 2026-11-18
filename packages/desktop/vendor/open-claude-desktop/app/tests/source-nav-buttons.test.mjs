import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// SSR of the Back/Forward cluster (2.2553.1 sidebar-session.js:10732-10800 qM) and its
// collapsed-titlebar placement (sidebar-groups.js:2774-2840 Ib df-collapsed-chrome/df-collapsed-nav).
let server, N, T;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  N = await server.ssrLoadModule('/src/source-nav-buttons.jsx');
  T = await server.ssrLoadModule('/src/source-titlebar.jsx');
});
after(() => server?.close());
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const buttons = html => html.split('<button').slice(1).map(chunk => chunk.slice(0, chunk.indexOf('>')));

test('navAvailability mirrors travel() bounds', () => {
  assert.deepEqual(N.navAvailability(0, 1), { canGoBack: false, canGoForward: false });
  assert.deepEqual(N.navAvailability(0, 2), { canGoBack: false, canGoForward: true });
  assert.deepEqual(N.navAvailability(1, 2), { canGoBack: true, canGoForward: false });
  assert.deepEqual(N.navAvailability(1, 3), { canGoBack: true, canGoForward: true });
});

test('qM: aria-disabled instead of disabled, no native title, Meta+[ / Meta+] shortcuts, sidebar wrapper', () => {
  const html = render(N.SourceNavButtons, { placement: 'sidebar', historyAt: 0, historyLength: 1 });
  assert.match(html, /^<div class="source-nav-buttons" data-placement="sidebar">/);
  const [back, forward] = buttons(html);
  for (const button of [back, forward]) {
    assert.match(button, /aria-disabled="true"/);
    assert.doesNotMatch(button, /\sdisabled(=|\s|$)/);
    assert.doesNotMatch(button, /title=/);
  }
  assert.match(back, /aria-label="Back"/); assert.match(back, /aria-keyshortcuts="Meta\+\["/);
  assert.match(forward, /aria-label="Forward"/); assert.match(forward, /aria-keyshortcuts="Meta\+\]"/);
  const middle = buttons(render(N.SourceNavButtons, { placement: 'sidebar', historyAt: 1, historyLength: 3 }));
  for (const button of middle) assert.doesNotMatch(button, /aria-disabled/);
  assert.deepEqual(N.NAV_TOOLTIPS, {
    back: { content: 'Back', shortcut: 'cmd+[', side: 'bottom', hoverable: false },
    forward: { content: 'Forward', shortcut: 'cmd+]', side: 'bottom', hoverable: false },
  });
});

test('Ib: the collapsed titlebar renders Show sidebar then df-collapsed-nav with Back/Forward; expanded renders neither', () => {
  const collapsed = render(T.SourceTitlebar, { collapsed: true, section: 'new', historyAt: 1, historyLength: 2 });
  const chrome = collapsed.slice(collapsed.indexOf('<div class="df-collapsed-chrome">'));
  assert.ok(chrome.length < collapsed.length);
  const labels = [...chrome.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map(match => match[1]).slice(0, 3);
  assert.deepEqual(labels, ['Show sidebar', 'Back', 'Forward']);
  assert.ok(chrome.indexOf('<div class="df-collapsed-nav"><div class="source-nav-buttons" data-placement="sidebar">') > chrome.indexOf('aria-label="Show sidebar"'));
  const [back, forward] = buttons(chrome.slice(chrome.indexOf('df-collapsed-nav')));
  assert.doesNotMatch(back, /aria-disabled/); assert.match(forward, /aria-disabled="true"/);
  const expanded = render(T.SourceTitlebar, { collapsed: false, section: 'new', historyAt: 1, historyLength: 2 });
  assert.doesNotMatch(expanded, /df-collapsed-nav|aria-label="Back"/);
});
