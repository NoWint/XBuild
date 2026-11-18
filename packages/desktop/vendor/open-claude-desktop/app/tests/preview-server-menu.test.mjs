import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsers } from '../../tools/node_modules/prettier/plugins/babel.mjs';
import { serverMenuRows } from '../src/preview-model.mjs';
import { createPreviewServerMenu } from '../src/generated/code-editor/preview-server-menu.mjs';

const original = fs.readFileSync(new URL('../../reference/current-2.31226.0/ion-dist/assets/v1/cf580efe9-Cz_m1KNC.js', import.meta.url), 'utf8');
const nodes = parsers.babel.parse(original, {}).program.body;
const first = nodes.find(node => node.id?.name === 'Mr');
const last = nodes.find(node => node.id?.name === 'Rr');
const body = original.slice(first.start, last.start);
const Button = ({ children, icon, iconOnly, tooltip, ...props }) => jsx('button', { ...props, 'data-icon': icon, children });
const deps = { Button, Spinner: () => jsx('i', { 'data-spinner': true }), Provider: React.Fragment,
  useStable: value => value, useOptionalStable: value => value,
};
const extracted = createPreviewServerMenu(deps).useSections;
const source = vm.runInNewContext(`(()=>{${body};return Ir;})()`, {
  e: React.useState, l: React.useCallback, p: React.useMemo, f: React.memo, s: React.Fragment, c: React.Fragment,
  o: jsx, u: jsxs, g: value => value, v: value => value, H: Button, Ce: deps.Spinner, En: event => event.preventDefault(),
});
function read(hook, props) {
  let result;
  renderToStaticMarkup(jsx(() => { result = hook(props); return null; }, {}));
  return result;
}
const defaults = { servers: [], onRun() {}, onStop() {} };
const simplify = result => ({ trigger: result.trigger, sections: result.sections.map(section => ({
  key: section.key, header: section.header, noSeparator: section.noSeparator,
  items: section.items.map(({ label, leading, trailing, onSelect, ...rest }) => ({ ...rest,
    label: renderToStaticMarkup(jsx(React.Fragment, { children: label })),
    leading: renderToStaticMarkup(jsx(React.Fragment, { children: leading })),
    trailing: renderToStaticMarkup(jsx(React.Fragment, { children: trailing })),
  })),
})) });

test('current server section structure matches original across loading, empty, starting and multi-server states', () => {
  for (const state of [
    {}, { loading: true }, { loading: true, onAddServer() {} }, { onAddServer() {} },
    { servers: [{ id: 'a', label: 'Web', running: false }] },
    { servers: [{ id: 'a', label: 'Web', running: true, starting: true }] },
    { servers: [{ id: 'a', label: 'Web', running: true }, { id: 'b', label: 'API', running: false }], onStopAll() {}, onAddServer() {} },
    { loading: true, extraSections: [{ header: 'Other', items: [{ label: 'Extra' }] }] },
  ]) assert.equal(JSON.stringify(simplify(read(extracted, { ...defaults, ...state }))), JSON.stringify(simplify(read(source, { ...defaults, ...state }))));
});

test('source server row and its pointer-only button dispatch once and close; starting servers can stop', () => {
  const calls = [];
  const sections = read(extracted, { servers: [
    { id: 'web', label: 'Web', running: false },
    { id: 'api', label: 'API', running: true, starting: true },
  ], onRun: id => calls.push(['run', id]), onStop: id => calls.push(['stop', id]), onAction: () => calls.push(['close']) }).sections;
  sections[0].items[0].onSelect();
  const button = sections[0].items[1].trailing;
  button.props.onClick({ stopPropagation: () => calls.push(['stopPropagation']) });
  assert.deepEqual(calls, [['run', 'web'], ['close'], ['stopPropagation'], ['stop', 'api'], ['close']]);
  assert.equal(button.props.tabIndex, -1);
  assert.equal(button.props['aria-hidden'], true);
  assert.equal(button.props.className, 'min-w-8 shrink-0');
  assert.equal(button.props.variant, 'danger');
  assert.ok(sections[0].items[1].leading);
});

test('Stop all follows original multiple-server rule; empty add-server menu suppresses placeholder', () => {
  const onStopAll = () => {};
  const running = { id: 'a', label: 'A', running: true };
  assert.equal(read(extracted, { ...defaults, servers: [running], onStopAll }).sections.length, 1);
  const two = read(extracted, { ...defaults, servers: [running, { id: 'b', label: 'B' }], onStopAll }).sections;
  assert.equal(two.at(-1).items[0].onSelect, onStopAll);
  assert.equal(two.at(-1).noSeparator, true);
  const add = () => {};
  const empty = read(extracted, { ...defaults, onAddServer: add }).sections;
  assert.equal(empty.length, 1); assert.equal(empty[0].key, 'add-server'); assert.equal(empty[0].items[0].onSelect, add);
});

 test('a process remains in the menu after its launch configuration is removed', () => {
  const rows = serverMenuRows({ launch: { configs: [{ name: 'web', port: 3000 }, { name: 'api', port: 4000 }] },
    servers: [{ name: 'web', status: 'starting', port: 3001 }, { name: 'removed', status: 'running', port: 5000 }] });
  assert.deepEqual(rows.map(row => [row.name, row.status, row.port]), [['web', 'starting', 3001], ['api', 'stopped', 4000], ['removed', 'running', 5000]]);
  assert.equal(rows.at(-1).running, true);
});
