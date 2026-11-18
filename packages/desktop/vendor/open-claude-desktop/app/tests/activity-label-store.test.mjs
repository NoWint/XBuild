import test from 'node:test';
import assert from 'node:assert/strict';
import { createActivityLabelStore } from '../src/activity-label-store.mjs';

function clock() {
  let time = 1000, sequence = 0;
  const jobs = new Map(), callbacks = [];
  return {
    performance: { now: () => time },
    setTimeout(fn, delay) { const id = ++sequence; jobs.set(id, { fn, at: time + delay }); callbacks.push(fn); return id; },
    clearTimeout: id => jobs.delete(id),
    advance(ms) {
      const end = time + ms;
      for (;;) {
        const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        time = next[1].at; jobs.delete(next[0]); next[1].fn();
      }
      time = end;
    },
    jobs, callbacks,
  };
}
const waiting = (label, owner = 'session/turn') => ({ owner, label, waiting: true });

test('waiting text requires 150ms stability, then retains each painted change for 650ms', () => {
  const host = clock(), labels = createActivityLabelStore(waiting('Working'), host), painted = [];
  const unsubscribe = labels.subscribe(() => painted.push(labels.getSnapshot()));
  labels.update(waiting('Tools'));
  host.advance(149); assert.equal(labels.getSnapshot(), 'Working');
  host.advance(1); assert.equal(labels.getSnapshot(), 'Tools');
  labels.update(waiting('Working'));
  host.advance(649); assert.equal(labels.getSnapshot(), 'Tools');
  host.advance(1); assert.equal(labels.getSnapshot(), 'Working');
  assert.deepEqual(painted, ['Tools', 'Working']);
  unsubscribe(); assert.equal(host.jobs.size, 0);
});

test('brief intermediate labels never paint; reverting a pending candidate cancels its hold', () => {
  const host = clock(), labels = createActivityLabelStore(waiting('Working'), host);
  const stop = labels.subscribe(() => {});
  labels.update(waiting('Tools')); host.advance(100);
  labels.update(waiting('Working')); host.advance(700);
  assert.equal(labels.getSnapshot(), 'Working'); assert.equal(host.jobs.size, 0);
  labels.update(waiting('Tools')); host.advance(150);
  labels.update(waiting('Working')); host.advance(150);
  labels.update(waiting('Tools')); host.advance(500);
  assert.equal(labels.getSnapshot(), 'Tools'); assert.equal(host.jobs.size, 0);
  stop();
});

test('new turns and priority states reset immediately, cancel stale callbacks and establish a fresh hold', () => {
  const host = clock(), labels = createActivityLabelStore(waiting('Tools'), host);
  const stop = labels.subscribe(() => {});
  labels.update(waiting('Working'));
  const old = host.callbacks.at(-1);
  labels.update(waiting('New turn', 'session/next')); old(); host.advance(149);
  assert.equal(labels.getSnapshot(), 'New turn');
  labels.update(waiting('Tools', 'session/next')); host.advance(500);
  assert.equal(labels.getSnapshot(), 'New turn'); host.advance(1);
  assert.equal(labels.getSnapshot(), 'Tools');
  for (const label of ['Thinking', 'Compacting', 'Stopping', 'Approval', '']) {
    labels.update({ owner: 'session/next', waiting: false, label });
    assert.equal(labels.getSnapshot(), label); assert.equal(host.jobs.size, 0);
  }
  stop();
});

test('last unsubscribe clears timers, queued callbacks cannot notify, and resubscription resumes the latest input', () => {
  const host = clock(), labels = createActivityLabelStore(waiting('Working'), host);
  let paints = 0;
  const stop = labels.subscribe(() => paints++);
  labels.update(waiting('Tools'));
  const queued = host.callbacks.at(-1);
  stop(); queued(); host.advance(1000);
  assert.equal(host.jobs.size, 0); assert.equal(paints, 0); assert.equal(labels.getSnapshot(), 'Working');
  const stopAgain = labels.subscribe(() => paints++);
  host.advance(150); assert.equal(labels.getSnapshot(), 'Tools'); assert.equal(paints, 1);
  stopAgain(); assert.equal(host.jobs.size, 0);
});
