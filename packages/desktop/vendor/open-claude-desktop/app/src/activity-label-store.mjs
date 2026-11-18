// Classic waiting labels: Ghe stabilizes candidates for 150ms; WM keeps each
// displayed label for 650ms. Priority states bypass this waiting-only clock.
export function createActivityLabelStore(initial, host = globalThis) {
  let input = initial, displayed = initial.label, stable = initial.label;
  let shownAt = 0, debounce, hold, generation = 0;
  const listeners = new Set();
  const now = () => host.performance.now();
  const clearTimers = () => {
    generation++;
    host.clearTimeout(debounce); host.clearTimeout(hold);
    debounce = hold = undefined;
  };
  const publish = label => {
    if (displayed === label) return;
    displayed = label; shownAt = now();
    for (const listener of listeners) listener();
  };
  const settle = () => {
    host.clearTimeout(hold); hold = undefined;
    if (stable === displayed) return;
    const remaining = Math.max(0, 650 - (now() - shownAt));
    if (!remaining) { publish(stable); return; }
    const expected = generation;
    hold = host.setTimeout(() => {
      if (expected === generation) { hold = undefined; publish(stable); }
    }, remaining);
  };
  const queueCandidate = () => {
    host.clearTimeout(debounce);
    if (input.label === stable) { debounce = undefined; return; }
    const expected = generation, candidate = input.label;
    debounce = host.setTimeout(() => {
      if (expected !== generation) return;
      debounce = undefined; stable = candidate; settle();
    }, 150);
  };
  return {
    getSnapshot: () => displayed,
    subscribe(listener) {
      const resume = !listeners.size;
      listeners.add(listener);
      if (resume && input.waiting) { queueCandidate(); settle(); }
      return () => { listeners.delete(listener); if (!listeners.size) clearTimers(); };
    },
    update(next) {
      const reset = next.owner !== input.owner || next.waiting !== input.waiting;
      if (!reset && next.label === input.label) return;
      input = next;
      if (reset || !next.waiting) {
        clearTimers(); stable = next.label; shownAt = now(); publish(next.label);
        return;
      }
      queueCandidate();
    },
  };
}
