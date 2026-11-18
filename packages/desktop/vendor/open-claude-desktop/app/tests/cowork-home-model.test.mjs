import test from 'node:test';
import assert from 'node:assert/strict';
import { coworkHomeState } from '../src/cowork-home-model.mjs';
import { Qm as isUnread } from '../src/generated/chat/shared-16-Cg1UfeMy.js';
import { Ew as liveStatus } from '../src/generated/chat/shared-4-D8W6lHTW.js';

test('Cowork home excludes Code, Chat, archives and child threads while retaining real task metadata', () => {
  const sessions = ['code', 'chat', 'task', 'archived', 'child', 'legacy-child'].map(id => ({ id, name: ` ${id} `, updatedAt: 1700000000 }));
  sessions[3].isArchived = true;
  sessions[5].source = { subAgent: { review: {} } };
  const metadata = Object.fromEntries(sessions.map(row => [row.id, { surface: row.id === 'code' ? undefined : row.id === 'chat' ? 'chat' : 'cowork' }]));
  metadata.task.pinned = true;
  const result = coworkHomeState(sessions, metadata, { threadParents: { child: 'task' } });
  assert.deepEqual(result.rows.map(row => row.sessionId), ['task']);
  assert.equal(result.rows[0].title, 'task');
  assert.equal(result.rows[0].isStarred, true);
  assert.equal(result.rows[0].lastActivityAt, 1700000000000);
});

test('nested approvals belong to their navigable parent and override running in the official status function', () => {
  const approval = { method: 'item/tool/requestUserInput', params: { threadId: 'grandchild' } };
  const data = coworkHomeState([{ id: 'task', updatedAt: 1700000000 }], { task: { surface: 'cowork' } }, {
    approvals: [approval], threadParents: { grandchild: 'child', child: 'task' }, active: { task: 'turn-id' },
  });
  assert.deepEqual(data.permissions.get('task'), [approval]);
  assert.equal(data.attentionIds.has('task'), true);
  assert.equal(data.rows[0].isRunning, true);
  assert.equal(liveStatus(data.rows[0]), 'awaiting');
});

test('source unread predicate tracks persisted read metadata without marking pins read or altering records', () => {
  const sessions = [{ id: 'task', updatedAt: 1700000000 }, { id: 'newer', updatedAt: '2024-01-01T00:00:00Z' }];
  const metadata = { task: { surface: 'cowork', unread: true, pinned: true }, newer: { surface: 'cowork', unread: false } };
  const data = coworkHomeState(sessions, metadata, {});
  assert.deepEqual(data.rows.map(row => row.sessionId), ['newer', 'task']);
  assert.equal(isUnread(data.rows[1], data.readState), true);
  assert.equal(isUnread(data.rows[0], data.readState), false);
  const read = coworkHomeState(sessions, { ...metadata, task: { ...metadata.task, unread: false } }, {});
  assert.equal(isUnread(read.rows[1], read.readState), false);
  assert.equal(read.rows[1].isStarred, true);
  assert.equal(metadata.task.unread, true);
});
