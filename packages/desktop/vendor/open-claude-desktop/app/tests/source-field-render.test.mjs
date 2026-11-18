import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

let server, source, current, FormSelect;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  current = await server.ssrLoadModule('/src/generated/current-chat/shared-frame-DVFSKIcx.js');
  source = await server.ssrLoadModule('/src/generated/chat/shared-frame-C_2npUJq.js');
  ({ FormSelect } = await server.ssrLoadModule('/src/source-routine-form-adapters.jsx'));
});
after(() => server?.close());
const h = React.createElement;
const render = node => renderToStaticMarkup(node);
const tag = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`))?.[0];
const attr = (html, name) => html?.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];

test('original TextField retains both hint and error, and links them to its invalid input', () => {
  const html = render(h(source.Sy, { label: 'Task name', hint: 'Use a unique name', error: 'Already exists', value: 'Notes', onChange() {} }));
  const input = tag(html, 'input'), label = tag(html, 'label');
  assert.equal(attr(label, 'for'), attr(input, 'id'));
  assert.equal(attr(input, 'aria-labelledby'), attr(label, 'id'));
  assert.equal(attr(input, 'aria-invalid'), 'true');
  assert.equal(attr(input, 'data-invalid'), 'true');
  assert.match(html, /Use a unique name/);
  assert.match(html, /Already exists/);
  assert.match(html, /role="alert"/);
  assert.match(html, /data-cds="Icon"/);
  const described = attr(input, 'aria-describedby').split(' ');
  assert.equal(described.length, 2);
  for (const id of described) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.indexOf('Use a unique name') < html.indexOf('Already exists'));
});

test('valid fields preserve explicit input IDs, required state and source hint typography', () => {
  const html = render(h(source.Sy, { label: 'Description', id: 'task-description', hint: 'What this does', required: true, value: '', onChange() {} }));
  assert.equal(attr(tag(html, 'label'), 'for'), 'task-description');
  assert.equal(attr(tag(html, 'input'), 'id'), 'task-description');
  assert.match(tag(html, 'input'), /required=""/);
  assert.doesNotMatch(html, /(?:aria-invalid|data-invalid)=|role="alert"/);
  assert.match(html, /text-footnote font-normal leading-snug text-muted/);
});

test('original field providers carry disabled state to inputs and the local select boundary', () => {
  for (const child of [h(source.Bh), h(FormSelect, { items: [{ value: 'daily', label: 'Daily' }], value: 'daily', onChange() {} })]) {
    const html = render(h(source._y, { disabled: true, className: 'contents' }, h(source.vy, null, 'Frequency'), child));
    const control = tag(html, child.type === source.Bh ? 'input' : 'button');
    assert.match(control, /disabled=""/);
    assert.equal(attr(control, 'aria-labelledby'), attr(tag(html, 'label'), 'id'));
    assert.equal(attr(control, 'id'), attr(tag(html, 'label'), 'for'));
    assert.match(tag(html, 'div'), /class="[^\"]*contents/);
    assert.doesNotMatch(tag(html, 'div'), /class="(?:[^"]* )?flex(?: |")/);
  }
});

test('nested fields do not replace the outer label or collect each other’s hints', () => {
  const html = render(h(source._y, null,
    h(source.vy, null, 'Instructions'),
    h('div', null, h(source.$v, { id: 'instructions', 'aria-label': 'Instructions', 'aria-describedby': 'external-help' }),
      h(source.Sy, { label: 'Inner name', hint: 'Inner hint', id: 'inner-name' }))));
  const textarea = tag(html, 'textarea');
  assert.equal(attr(tag(html, 'label'), 'for'), 'instructions');
  assert.equal(attr(textarea, 'aria-describedby'), 'external-help');
  assert.equal(attr(textarea, 'aria-label'), 'Instructions');
  assert.equal(attr(textarea, 'aria-labelledby'), undefined);
  assert.notEqual(attr(tag(html, 'input'), 'aria-describedby'), 'external-help');
});

test('unbound source inputs keep their existing explicit accessibility attributes', () => {
  const html = render(h(source.Bh, { id: 'search', 'aria-label': 'Search', 'aria-describedby': 'search-help', disabled: true }));
  const input = tag(html, 'input');
  assert.equal(attr(input, 'id'), 'search');
  assert.equal(attr(input, 'aria-label'), 'Search');
  assert.equal(attr(input, 'aria-describedby'), 'search-help');
  assert.equal(attr(input, 'aria-labelledby'), undefined);
  assert.match(input, /disabled=""/);
});

// Slotted controls pass disabled and hint attributes to the native-control boundary.
test('current slotted search retains disabled, hint and invalid semantics', () => {
  const html = render(h(current.yy, { id: 'current-search', 'aria-label': 'Search projects',
    'aria-describedby': 'search-hint', 'aria-invalid': true, disabled: true,
    slotStart: h('span', null, 'Search'), clearable: 'always', value: 'query', onChange() {} }));
  const input = tag(html, 'input');
  assert.match(input, /disabled=""/);
  assert.equal(attr(input, 'id'), 'current-search');
  assert.equal(attr(input, 'aria-describedby'), 'search-hint');
  assert.equal(attr(input, 'aria-invalid'), 'true');
  assert.doesNotMatch(html, /<button/);
});
