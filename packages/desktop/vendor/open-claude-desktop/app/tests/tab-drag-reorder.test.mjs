import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TAB_DRAG_THRESHOLD_PX, dragTargetIndex, moveToIndex } from '../src/use-tab-drag-reorder.mjs';

const read = (file) => readFileSync(path.join(import.meta.dirname, '..', file), 'utf8');

test('a dragged tab lands after every other tab whose centre it passed', () => {
  assert.equal(dragTargetIndex([50, 150, 250], 10), 0, 'dragged to the front');
  assert.equal(dragTargetIndex([50, 150, 250], 200), 2);
  assert.equal(dragTargetIndex([50, 150, 250], 400), 3, 'dragged to the end');
  assert.ok(TAB_DRAG_THRESHOLD_PX > 0);
});

test('moveToIndex moves one item and keeps the rest in order', () => {
  const tabs = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];
  assert.deepEqual(moveToIndex(tabs, 't3', 0, (tab) => tab.id).map((tab) => tab.id), ['t3', 't1', 't2']);
  assert.deepEqual(moveToIndex(['a', 'b', 'c'], 'a', 2), ['b', 'c', 'a']);
  assert.deepEqual(moveToIndex(['a', 'b', 'c'], 'a', 9), ['b', 'c', 'a'], 'clamped to the end');
  const same = ['a', 'b'];
  assert.equal(moveToIndex(same, 'a', 0), same);
  assert.equal(moveToIndex(same, 'z', 1), same);
});

test('the Terminal and Files strips drag through the shared hook and commit through their own reorder', () => {
  const terminal = read('src/source-terminal-pane.jsx');
  assert.match(terminal, /useTabDragReorder\(\{ stripRef: tabList, itemSelector: "\[data-terminal-id\]"/);
  assert.match(terminal, /onReorder: \(id, toIndex, fromIndex\) => terminals\.move\(owner, id, toIndex - fromIndex\)/);
  assert.match(terminal, /shownTabs\.map\(\(tab, index\) => \(\n\s+<TerminalTab key=\{tab\.id\} tab=\{tab\} onPointerDown=/);
  const files = read('src/source-session.jsx');
  assert.match(files, /useTabDragReorder\(\{ stripRef: tabList, itemSelector: "\[data-vtb-id\]"/);
  assert.match(files, /fileTabDrag\.order\(fileTabs, \(file\) => file\.path\)\.map/);
  assert.match(files, /onPointerDown=\{overflowed \? undefined : onPointerDown\}/);
  assert.match(read('src/source-session.css'), /\.source-file-tab\[data-tab-dragging\] \{\n  z-index: 2;\n\}/);
});
