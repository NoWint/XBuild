import { transitionMilliseconds } from './response-table-model.mjs';

// Retain the actual dialog until its own opacity transition ends. Reopening
// cancels this subscription; a queued old event/timer cannot remove new UI.
export function waitForModalExit(element, complete) {
  const view = element.ownerDocument.defaultView;
  let active = true, timer;
  const cancel = () => {
    active = false;
    view.clearTimeout(timer);
    element.removeEventListener('transitionend', ended);
  };
  const finish = () => { if (active) { cancel(); complete(); } };
  const ended = event => {
    if (event.target === element && event.propertyName === 'opacity') finish();
  };
  element.addEventListener('transitionend', ended);
  timer = view.setTimeout(finish, transitionMilliseconds(view.getComputedStyle(element)));
  return cancel;
}

export function settingsTabIndex(index, count, key, rtl = false) {
  if (!count) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;
  const direction = (key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
  return (index + direction + count) % count;
}
