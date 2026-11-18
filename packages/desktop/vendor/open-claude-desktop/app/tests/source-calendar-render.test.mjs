import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

let server, calendar, dateInput, locale;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  calendar = await server.ssrLoadModule('/src/generated/chat/c8ff922bb-BPSJpmre.js');
  dateInput = await server.ssrLoadModule('/src/generated/chat/cff2bf6cb-rlnyJMOd.js');
  locale = await server.ssrLoadModule('/electron/i18n/index.mjs');
  locale.setLocale('en-US');
});
after(async () => { locale?.setLocale('en-US'); await server?.close(); });
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

test('source date input renders editable date segments and the original calendar trigger', () => {
  const html = render(dateInput.Zr, { value: '2026-10-15', onValueCommitted() {}, 'aria-label': 'Start date', name: 'start-date' });
  assert.match(html, /data-cds="DateInput"/);
  assert.equal((html.match(/role="spinbutton"/g) ?? []).length, 3);
  assert.match(html, /aria-label="month[^\"]*"/);
  assert.match(html, /aria-label="day[^\"]*"/);
  assert.match(html, /aria-label="year[^\"]*"/);
  assert.match(html, /type="hidden"[^>]*value="2026-10-15"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /type="date"/);
});

test('source date parsing rejects invalid days and preserves leap-day and month arithmetic', () => {
  for (const invalid of ['2026-02-29', '2026-13-01', '2026-04-31', 'not-a-date']) assert.equal(calendar.Q(invalid), undefined);
  const leap = calendar.Q('2028-02-29');
  assert.equal(leap.toString(), '2028-02-29');
  assert.equal(leap.add({ years: 1 }).toString(), '2029-02-28');
  assert.equal(calendar.Q('2026-12-31').add({ days: 1 }).toString(), '2027-01-01');
});

test('source month grid retains selected dates, disabled days and accessible month navigation', () => {
  const html = render(calendar.Ka, { value: '2026-10-15', minDate: '2026-10-10', maxDate: '2026-10-20',
    isDateUnavailable: date => date === '2026-10-16', 'aria-label': 'Choose start date' });
  assert.match(html, /data-cds="Calendar"/);
  assert.match(html, /October 2026/);
  assert.equal((html.match(/role="columnheader"/g) ?? []).length, 7);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /aria-label="Previous month"[^>]*disabled=""/);
  assert.match(html, /aria-label="Next month"[^>]*disabled=""/);
  const unavailable = html.match(/<div\b[^>]*aria-label="[^"]*October 16[^"]*"[^>]*>/)?.[0];
  assert.match(unavailable, /aria-disabled="true"/);
});

test('original locale initializers are retained for Chinese date segments and month labels', () => {
  locale.setLocale('zh-CN');
  try {
    const input = render(dateInput.Zr, { value: '2026-10-15', 'aria-label': '开始日期' });
    assert.match(input, /aria-label="年[^\"]*"/);
    assert.match(input, /aria-label="月[^\"]*"/);
    const month = render(calendar.Ka, { value: '2026-10-15', 'aria-label': '开始日期' });
    assert.match(month, /2026年10月/);
    assert.match(month, /已选|选定/);
  } finally { locale.setLocale('en-US'); }
});

test('calendar provenance records the original module initialization statements', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../src/generated/chat/provenance.json', import.meta.url)));
  for (const name of ['c8ff922bb-BPSJpmre.js', 'cff2bf6cb-rlnyJMOd.js']) {
    const entry = manifest.find(entry => entry.source === name);
    assert.ok(entry.initializers.length > 30, name);
    const original = await fs.readFile(new URL(`../../reference/current-2.2553.1/ion-dist/assets/v1/${name}`, import.meta.url), 'utf8');
    const generated = await fs.readFile(new URL(`../src/generated/chat/${name}`, import.meta.url), 'utf8');
    for (const { start, end } of entry.initializers) assert.ok(generated.includes(original.slice(start, end)), `${name}:${start}`);
  }
});
