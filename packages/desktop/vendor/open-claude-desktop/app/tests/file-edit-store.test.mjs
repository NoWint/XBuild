import test from 'node:test';
import assert from 'node:assert/strict';
import { getFileEditor, fileEditGuards, guardFileEdits } from '../src/file-edit-store.mjs';
let id = 0;
const create = save => getFileEditor({ key: `test-${++id}`, path: 'notes.txt', sessionId: `session-${id}`, text: 'one', hash: 'h1', save });
test('keep editing retains draft; discard resumes the exact pending action', () => {
  const editor = create(); editor.change('draft'); let runs = 0;
  assert.equal(guardFileEdits(() => runs++, { key: editor.key }), true);
  fileEditGuards.cancel(); assert.equal(runs, 0); assert.equal(editor.getSnapshot().text, 'draft');
  guardFileEdits(() => runs++, { key: editor.key }); fileEditGuards.discard();
  assert.equal(runs, 1); assert.equal(editor.dirty, false);
});
test('edits during saving survive; another save uses the returned hash', async () => {
  let resolve, sent;
  const editor = create((...args) => { sent = args; return new Promise(r => { resolve = r; }); });
  editor.change('two'); const pending = editor.save(); editor.change('three'); await Promise.resolve();
  assert.deepEqual(sent, ['two','h1']); resolve({ status: 'saved', hash: 'h2' }); await pending;
  assert.equal(editor.dirty, true); assert.equal(editor.getSnapshot().text, 'three');
  const next = editor.save(); await Promise.resolve(); assert.deepEqual(sent, ['three','h2']); resolve({ status: 'saved', hash: 'h3' }); await next;
  assert.equal(editor.dirty, false);
});
test('conflict retains draft and override compares against the reported disk hash', async () => {
  let args;
  const editor = create(async (...values) => { args = values; return { status: 'conflict', currentHash: 'disk' }; });
  editor.change('mine'); await editor.save(); assert.equal(editor.dirty, true);
  await editor.save({ override: true }); assert.deepEqual(args, ['mine','disk']); editor.discard();
});
test('a remount retains dirty draft; stale props after save do not restore old contents', async () => {
  const editor = create(async () => ({ status: 'saved', hash: 'h2' }));
  editor.change('two'); await editor.save();
  const remount = getFileEditor({ key: editor.key, path: editor.path, sessionId: editor.sessionId, text: 'one', hash: 'h1', save: editor.saveFile });
  assert.equal(remount.getSnapshot().text, 'two');
  remount.change('unsaved');
  getFileEditor({ key: editor.key, path: editor.path, sessionId: editor.sessionId, text: 'disk', hash: 'h3', save: editor.saveFile });
  assert.equal(remount.getSnapshot().text, 'unsaved'); remount.discard();
});
