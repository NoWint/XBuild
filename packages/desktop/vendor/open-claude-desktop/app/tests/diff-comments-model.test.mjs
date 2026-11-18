// B14 D4/D5: Changes-pane inline comments (c44d00c7f Ho/Vo/la/pa/Qa, caec4a2d4 In, cf56e4ee1 t).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff } from '../src/diff-model.js';
import { DIFF_COMMENTS_PREFIX, addCommentLabel, anchorDiffSpan, createDiffCommentsStore, diffCommentAttachmentKey, diffCommentKey, diffCommentOutdated,
  diffLineIndex, diffSelectionSpan, diffSpanText, placeDiffComment, rowCommentTarget, selectionChipPosition } from '../src/diff-comments-model.mjs';
import { serializeLineComment } from '../src/inline-comments.mjs';
import { addSnippet, makeSnippet, removeSnippetByKey, snippetText } from '../src/composer-attachments-model.mjs';

const patch = [
  'diff --git a/src/a.js b/src/a.js', '--- a/src/a.js', '+++ b/src/a.js',
  '@@ -1,6 +1,7 @@', ' one', ' two', '-three', '+THREE', '+three-b', ' four', ' five', ' six',
  '@@ -20,3 +21,3 @@', ' twenty', '-old21', '+new22', ' twentytwo', '',
].join('\n');
const file = () => parseUnifiedDiff(patch).files[0];
const fixture = () => {
  const values = new Map();
  const storage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) };
  return { storage, values, store: createDiffCommentsStore({ scope: 'session\0src/a.js', storage }) };
};

test('cards are keyed by side and end line (Je), one per key; a saved comment reopens for editing', () => {
  assert.equal(diffCommentKey('additions', 4), 'additions:4');
  const { store } = fixture();
  assert.equal(store.create('additions', 5, 3, 'a\r\nb\n'), 'additions:5');
  const [entry] = store.getSnapshot().entries;
  assert.deepEqual([entry.start, entry.end, entry.code, store.getSnapshot().active], [3, 5, 'a\nb', 'additions:5']);
  assert.equal(store.create('deletions', 5, 5, 'x'), 'deletions:5', 'the other side of the same line is its own card');
  assert.deepEqual(store.getSnapshot().entries.map((e) => e.id), ['deletions:5', 'additions:5']);
  store.edit('additions:5', ' fix this ');
  assert.equal(store.create('additions', 4, 5, 'b'), 'additions:5', 'a new range at the key replaces the draft range');
  assert.deepEqual([store.getSnapshot().entries[1].start, store.getSnapshot().entries[1].body], [4, ' fix this ']);
  assert.equal(store.create('additions', 5, 5, 'b'), 'additions:5', 'a single line reopens the card at its key');
  assert.equal(store.getSnapshot().entries[1].start, 4);
  const saved = store.save('additions:5');
  assert.equal(saved.savedBody, 'fix this');
  assert.equal(store.getSnapshot().active, null);
  store.create('additions', 1, 5, 'other');
  assert.deepEqual([store.getSnapshot().active, store.getSnapshot().entries[1].start], ['additions:5', 4], 'a saved comment keeps its range');
  store.edit('additions:5', 'changed'); store.cancel('additions:5');
  assert.equal(store.getSnapshot().entries[1].body, 'fix this');
  store.cancel('deletions:5');
  assert.deepEqual(store.getSnapshot().entries.map((e) => e.id), ['additions:5'], 'cancelling an unsaved draft drops it');
});

test('comments persist per scope; release drops abandoned empty drafts; storage events sync other windows', () => {
  const { store, storage, values } = fixture();
  store.create('additions', 2, 2, 'two'); store.edit('additions:2', 'keep');
  store.create('deletions', 3, 3, 'three');
  store.release();
  assert.deepEqual(store.getSnapshot().entries.map((e) => e.id), ['additions:2']);
  let notify;
  const other = createDiffCommentsStore({ scope: 'session\0src/a.js', storage, subscribeStorage: (fn) => { notify = fn; return () => {}; } });
  assert.equal(other.getSnapshot().entries[0].body, 'keep');
  store.save('additions:2'); notify({ key: DIFF_COMMENTS_PREFIX + 'session\0src/a.js' });
  assert.equal(other.getSnapshot().entries[0].savedBody, 'keep');
  store.remove('additions:2');
  assert.equal(values.size, 0);
  values.set(DIFF_COMMENTS_PREFIX + 'bad', '{"x":1}');
  assert.deepEqual(createDiffCommentsStore({ scope: 'bad', storage }).getSnapshot().entries, []);
  const denied = createDiffCommentsStore({ scope: 'x', storage: { getItem() { throw Error(); }, setItem() { throw Error(); } } });
  denied.create('additions', 1, 1, ''); denied.edit('additions:1', 'ok');
  assert.equal(denied.save('additions:1').body, 'ok');
  assert.equal(createDiffCommentsStore({ scope: 'y', storage }).create('middle', 1, 1), null);
});

test('rows comment on the old file only when removed (or in the split view\'s left column)', () => {
  assert.deepEqual(rowCommentTarget({ type: 'removed', oldLine: 3, newLine: null }), { side: 'deletions', line: 3 });
  assert.deepEqual(rowCommentTarget({ type: 'context', oldLine: 4, newLine: 5 }), { side: 'additions', line: 5 });
  assert.deepEqual(rowCommentTarget({ type: 'context', oldLine: 4, newLine: 5 }, 'before'), { side: 'deletions', line: 4 });
  assert.deepEqual(rowCommentTarget({ type: 'added', oldLine: null, newLine: 3 }, 'after'), { side: 'additions', line: 3 });
  assert.equal(rowCommentTarget({ type: 'note', text: 'x' }), null);
});

test('Vo: an old-file span over unchanged lines moves to the new file; one touching a change stays', () => {
  const { hunks } = file();
  assert.deepEqual(anchorDiffSpan(hunks, 1, 2, 'deletions'), { start: 1, end: 2, side: 'additions' });
  assert.deepEqual(anchorDiffSpan(hunks, 5, 4, 'deletions'), { start: 5, end: 6, side: 'additions' }, 'after +2/-1 the offset is +1');
  assert.deepEqual(anchorDiffSpan(hunks, 3, 3, 'deletions'), { start: 3, end: 3, side: 'deletions' });
  assert.deepEqual(anchorDiffSpan(hunks, 2, 4, 'deletions'), { start: 2, end: 4, side: 'deletions' });
  assert.deepEqual(anchorDiffSpan(hunks, 10, 12, 'deletions'), { start: 11, end: 13, side: 'additions' }, 'between hunks');
  assert.deepEqual(anchorDiffSpan(hunks, 21, 21, 'deletions'), { start: 21, end: 21, side: 'deletions' });
  assert.deepEqual(anchorDiffSpan(hunks, 22, 22, 'deletions'), { start: 23, end: 23, side: 'additions' }, 'hunk 2 is -1/+1, so the +1 of hunk 1 stays');
  assert.deepEqual(anchorDiffSpan(hunks, 7, 7, 'additions'), { start: 7, end: 7, side: 'additions' });
  // Vo isPartial: only a span inside one hunk's old-file range is mapped when just the patch is known.
  assert.deepEqual(anchorDiffSpan(hunks, 5, 4, 'deletions', { partial: true }), { start: 5, end: 6, side: 'additions' });
  assert.deepEqual(anchorDiffSpan(hunks, 10, 12, 'deletions', { partial: true }), { start: 10, end: 12, side: 'deletions' });
  assert.deepEqual(anchorDiffSpan(hunks, 6, 20, 'deletions', { partial: true }), { start: 6, end: 20, side: 'deletions' }, 'across two hunks');
  const pure = parseUnifiedDiff(['diff --git a/b b/b', '--- a/b', '+++ b/b', '@@ -1,2 +1,3 @@', ' a', '+inserted', ' b', ''].join('\n')).files[0].hunks;
  assert.deepEqual(anchorDiffSpan(pure, 1, 2, 'deletions'), { start: 1, end: 2, side: 'deletions' }, 'a span across an insertion stays on the old file');
  assert.deepEqual(anchorDiffSpan(pure, 2, 2, 'deletions'), { start: 3, end: 3, side: 'additions' });
});

test('snippets, outdated (la) and displaced (pa/da) comments come from the shown rows', () => {
  const index = diffLineIndex(file().hunks);
  assert.equal(diffSpanText(index, 'additions', 3, 4), 'THREE\nthree-b');
  assert.equal(diffSpanText(index, 'deletions', 3, 3), 'three');
  assert.equal(diffSpanText(index, 'additions', 9, 10), undefined, 'a line that is not shown');
  assert.equal(diffCommentOutdated(index, { side: 'additions', start: 3, end: 4, code: '  THREE\nthree-b  ' }), false, 'whitespace at the ends is ignored');
  assert.equal(diffCommentOutdated(index, { side: 'additions', start: 3, end: 4, code: 'three\nthree-b' }), true);
  assert.equal(diffCommentOutdated(index, { side: 'additions', start: 9, end: 9, code: 'gone' }), false, 'unknown lines are not outdated');
  assert.deepEqual(placeDiffComment(index, { side: 'additions', end: 5 }), { side: 'additions', line: 5, displaced: false, lineGone: false });
  assert.deepEqual(placeDiffComment(index, { side: 'additions', end: 40 }), { side: 'additions', line: 23, displaced: true, lineGone: false });
  assert.deepEqual(placeDiffComment(index, { side: 'deletions', end: 40 }, { complete: true }), { side: 'deletions', line: 22, displaced: true, lineGone: true });
});

test('Qa: a selection comments on its new-file rows, else its old-file rows, never across split columns', () => {
  assert.deepEqual(diffSelectionSpan([{ side: 'deletions', line: 3, text: 'three', column: 'unified' }, { side: 'additions', line: 4, text: 'three-b\n', column: 'unified' }, { side: 'additions', line: 3, text: 'THREE', column: 'unified' }]),
    { startLine: 3, endLine: 4, side: 'additions', lineTexts: ['THREE', 'three-b'] });
  assert.deepEqual(diffSelectionSpan([{ side: 'deletions', line: 3, text: 'three', column: 'before' }]), { startLine: 3, endLine: 3, side: 'deletions', lineTexts: ['three'] });
  assert.equal(diffSelectionSpan([{ side: 'deletions', line: 3, column: 'before' }, { side: 'additions', line: 3, column: 'after' }]), null);
  assert.equal(diffSelectionSpan([]), null);
});

test('chip placement, aria labels and the attachment a saved comment rides on', () => {
  assert.deepEqual(selectionChipPosition({ clientX: 10, clientY: 300, left: 0, width: 600, scrollerTop: 100 }), { x: 72, y: 300, flipBelow: false });
  assert.deepEqual(selectionChipPosition({ clientX: 590, clientY: 120, left: 0, width: 600, scrollerTop: 100 }), { x: 528, y: 120, flipBelow: true });
  assert.equal(addCommentLabel({ start: 4, end: 4 }), 'Add comment on line 4');
  assert.equal(addCommentLabel({ start: 2, end: 5 }), 'Add comment on lines 2–5');
  const key = diffCommentAttachmentKey('["s","/w"]', 'src/a.js', 'deletions:3');
  const text = serializeLineComment({ path: 'src/a.js', start: 3, end: 3, side: 'deletions', code: 'three', text: 'why removed?' });
  assert.match(text, /^In src\/a\.js, removed line 3:\n> three\nwhy removed\?$/);
  assert.match(serializeLineComment({ path: 'src/a.js', start: 2, end: 4, side: 'additions', code: 'a', text: 'x' }), /^In src\/a\.js, lines 2–4:/);
  let attachments = addSnippet([], makeSnippet(text, { key }));
  attachments = addSnippet(attachments, makeSnippet(text.replace('why', 'how'), { key }));
  assert.equal(attachments.length, 1);
  assert.match(snippetText(attachments), /how removed/);
  assert.deepEqual(removeSnippetByKey(attachments, key), []);
});
