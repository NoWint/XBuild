import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsers } from '../../tools/node_modules/prettier/plugins/babel.mjs';
import { createPreviewSettingsMenu } from '../src/generated/code-editor/preview-settings-menu.mjs';
const original = fs.readFileSync(new URL('../../reference/current-2.31226.0/ion-dist/assets/v1/c224804cc-Cihs1Tbi.js', import.meta.url), 'utf8');
const nodes = parsers.babel.parse(original, {}).program.body;
const begin = nodes.find(n => n.declarations?.some(d => d.id.name === 'oe'));
const end = nodes.find(n => n.id?.name === 'B');
const body = original.slice(begin.start, end.end);
const source = vm.runInNewContext(`(()=>{${body};return B;})()`, { u: value => value, l: React.useMemo });
const extracted = createPreviewSettingsMenu({ useOptionalStable: value => value }).useSections;
function read(hook, props) {
  let result;
  renderToStaticMarkup(React.createElement(() => { result = hook(props); return null; }));
  return result.sections;
}
const noop = () => {};
const all = { onOpenExternal: noop, onCopyUrl: noop, onScreenshot: noop, onShowAnnotationTools: noop,
  onOpenFile: noop, onExport: noop, onColorScheme: noop, onShowSessionLogs: noop,
  onOpenLinksInPreviewChange: noop, onAutoVerifyChange: noop, onAllowedSites: noop,
  onImportChromeLogins: noop, onUseImportedCookies: noop, onClearBrowsingData: noop, onPreviewStorageChange: noop,
  previewStorage: 'none', viewportItems: [{ label: 'Responsive', checked: true }], colorScheme: 'system', autoVerify: true,
};
test('settings section data matches original with capability gates, disabled states and storage modes', () => {
  for (const props of [{}, all, { ...all, previewStorage: 'shared' }, { ...all, previewStorage: 'session' },
    { onOpenFile: noop }, { ...all, viewportDisabled: true, openExternalDisabled: true, copyUrlDisabled: true, screenshotDisabled: true }]) {
    assert.equal(JSON.stringify(read(extracted, props)), JSON.stringify(read(source, props)));
  }
});
test('original action order, checkbox keep-open and three-way cookie selection retain callbacks', () => {
  const calls = [];
  const sections = read(extracted, { ...all, onAutoVerifyChange: value => calls.push(['verify', value]),
    onPreviewStorageChange: value => calls.push(['storage', value]) });
  assert.deepEqual(sections[0].items.map(i => i.label), ['Open in default browser', 'Copy URL', 'Save screenshot', 'Show annotation tools', 'Open HTML file…', 'Export']);
  const verify = sections[2].items.find(i => i.label === 'Auto-verify changes');
  assert.equal(verify.keepOpen, true);assert.equal(verify.checkedRole, 'checkbox');verify.onSelect();
  const cookies = sections[3].items.find(i => i.label === 'Keep cookies');
  assert.deepEqual(cookies.items.map(i => i.label), ['Until quit', 'Shared', 'Per session']);
  assert.equal(cookies.hint, 'Until quit');assert.equal(cookies.items[0].checked, true);
  cookies.items[2].onSelect();assert.deepEqual(calls, [['verify', false], ['storage', 'session']]);
});
