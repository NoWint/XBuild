import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// SSR of the titlebar Changes toggle: panes-toggle-current.js:3160-3172 diff spec and cl
// (:3571-3593), sl dot (:3565-3570) through the Button indicator grid (shared-frame-C_2npUJq.js:2885-2905).
let server, T;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  T = await server.ssrLoadModule('/src/source-titlebar.jsx');
});
after(() => server?.close());
const session = { id: 'a', name: 'A', cwd: '/tmp/work' };
const render = props => renderToStaticMarkup(React.createElement(T.SourceTitlebar, { section: 'new', session, ...props }));
const changes = html => {
  const start = html.indexOf('<button', html.lastIndexOf('<button', html.indexOf('aria-label="Changes"')));
  return html.slice(start, html.indexOf('</button>', start) + 9);
};

test('cl: constant "Changes" label, aria-pressed follows the pane, Meta+Shift+D, no native title', () => {
  for (const open of [false, true]) {
    const button = changes(render({ panes: new Set(open ? ['changes'] : []) }));
    const tag = button.slice(0, button.indexOf('>'));
    assert.match(tag, /aria-label="Changes"/);
    assert.match(tag, new RegExp(`aria-pressed="${open}"`));
    assert.match(tag, /aria-keyshortcuts="Meta\+Shift\+D"/);
    assert.doesNotMatch(tag, /title=/);
  }
  assert.doesNotMatch(render({}), /Show changes/);
  // Fidelity F02: a key spec, drawn by the tooltip's text-variant Shortcut as ⇧⌘D (shared-frame Mu).
  assert.deepEqual(T.CHANGES_TOOLTIP, { content: 'Changes', shortcut: 'cmd+shift+d', side: 'bottom', hoverable: true });
});

test('sl indicator renders only when the tree is dirty and the pane is closed', () => {
  const dirty = changes(render({ changesDirty: true }));
  assert.match(dirty, /<span class="st-indicator-grid"><span class="st-indicator-icon">.*<\/span><span aria-hidden="true" data-cds-part="indicator" class="st-indicator"><span class="st-indicator-dot"><\/span><\/span><\/span>/s);
  assert.equal((dirty.match(/data-cds-part="indicator"/g) || []).length, 1);
  for (const props of [{ changesDirty: false }, {}, { changesDirty: true, panes: new Set(['changes']) }]) {
    const button = changes(render(props));
    assert.doesNotMatch(button, /data-cds-part="indicator"|st-indicator/);
    assert.match(button, /<svg|<span/);
  }
  assert.doesNotMatch(render({ session: null, changesDirty: true }), /aria-label="Changes"|data-cds-part="indicator"/);
});
