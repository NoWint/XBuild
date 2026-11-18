// Pointer-drag reordering for a pane's tab strip (2.2553.1 readable/panes-tabs-current.js Oe :880-1080, passed as
// onReorder to the Files and Terminal strips, panes-tile-current.js:2414 / :6782): a primary press on a tab that moves
// past a small threshold lifts it (pointer capture, the selection cleared, the tab painted opaque), it follows the
// pointer inside the strip while the others take their new slots live, and releasing commits the move through
// onReorder(id, toIndex). Escape, a lost window focus or a cancelled pointer put it back; the click that ends a drag
// never selects. A press that never moves is an ordinary click. The keyboard chord (Ctrl/⌘+Shift+←/→) stays the
// accessible path. No animation is drawn, so reduced motion needs nothing more.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const TAB_DRAG_THRESHOLD_PX = 4;

/** The slot a dragged tab takes: how many other tabs' centres lie before its own (clamped into the strip). Pure. */
export function dragTargetIndex(otherCentres, draggedCentre) {
  return otherCentres.reduce((count, centre) => count + (draggedCentre > centre ? 1 : 0), 0);
}

/** `list` with the item `id` (read by `idOf`) moved to `toIndex`; the same list when nothing moves. Pure. */
export function moveToIndex(list, id, toIndex, idOf = (item) => item) {
  const from = list.findIndex((item) => idOf(item) === id);
  if (from < 0 || !Number.isInteger(toIndex)) return list;
  const to = Math.max(0, Math.min(list.length - 1, toIndex));
  if (to === from) return list;
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// The colour the tab sits on (the first opaque background up its ancestors), so a lifted tab hides what it crosses.
function opaqueBackground(element) {
  const view = element.ownerDocument.defaultView;
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    const color = view?.getComputedStyle(node).backgroundColor;
    if (color && color !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(color)) return color;
  }
  return "";
}

/**
 * stripRef: the tablist; itemSelector / idOf: how a tab element is found and named; onReorder(id, toIndex, fromIndex).
 * Returns { order(list, idOf), onPointerDown(id, event), draggingId }.
 */
export function useTabDragReorder({ stripRef, itemSelector, idOf, onReorder }) {
  const [preview, setPreview] = useState(null);
  const drag = useRef(null), stopSuppress = useRef(null);
  const latest = useRef(null);
  latest.current = { onReorder, itemSelector, idOf };

  const place = useCallback(() => {
    const state = drag.current, strip = stripRef.current;
    if (!state?.live || !strip || !state.el.isConnected) return;
    const rect = strip.getBoundingClientRect();
    const saved = state.el.style.transform;
    state.el.style.transform = "none";
    const layoutLeft = state.el.getBoundingClientRect().left;
    state.el.style.transform = saved;
    const want = Math.min(Math.max(state.lastX - state.grabX, rect.left), Math.max(rect.left, rect.right - state.el.offsetWidth));
    state.el.style.transform = `translateX(${Math.round(want - layoutLeft)}px)`;
  }, [stripRef]);
  useLayoutEffect(() => { place(); }, [preview, place]);
  useEffect(() => () => { drag.current?.cleanup(); stopSuppress.current?.(); }, []);

  const onPointerDown = useCallback((id, event) => {
    if (event.button !== 0 || event.isPrimary === false || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || drag.current) return;
    if (event.target?.closest?.("button, input, textarea")) return;
    const el = event.currentTarget, doc = el.ownerDocument, win = doc.defaultView;
    if (!win) return;
    const pointerId = event.pointerId;
    const state = { id, el, pointerId, startX: event.clientX, lastX: event.clientX, grabX: event.clientX - el.getBoundingClientRect().left, live: false, from: -1, to: -1 };
    const items = () => [...(stripRef.current?.querySelectorAll(latest.current.itemSelector) ?? [])];
    const target = () => {
      const strip = stripRef.current;
      if (!strip) return state.to;
      const rect = strip.getBoundingClientRect();
      const centre = Math.min(Math.max(state.lastX - state.grabX + el.offsetWidth / 2, rect.left + 4), rect.right - 4);
      const others = items().filter((node) => node !== el).map((node) => { const box = node.getBoundingClientRect(); return box.left + box.width / 2; });
      return dragTargetIndex(others, centre);
    };
    const suppressClick = () => {
      stopSuppress.current?.();
      const swallow = (click) => { click.preventDefault(); click.stopPropagation(); stop(); };
      const stop = () => {
        doc.removeEventListener("click", swallow, true);
        doc.removeEventListener("pointerdown", stop, true);
        doc.removeEventListener("keydown", stop, true);
        stopSuppress.current = null;
      };
      doc.addEventListener("click", swallow, true);
      doc.addEventListener("pointerdown", stop, true);
      doc.addEventListener("keydown", stop, true);
      stopSuppress.current = stop;
    };
    const finish = (commit) => {
      state.cleanup();
      drag.current = null;
      if (!state.live) return;
      el.style.transform = "";
      el.style.transition = "";
      el.style.backgroundColor = "";
      el.removeAttribute("data-tab-dragging");
      try { el.releasePointerCapture?.(pointerId); } catch {}
      setPreview(null);
      suppressClick();
      if (commit && state.to >= 0 && state.to !== state.from) latest.current.onReorder?.(id, state.to, state.from);
    };
    const move = (moved) => {
      if (moved.pointerId !== pointerId) return;
      if (moved.buttons === 0) { finish(true); return; }
      state.lastX = moved.clientX;
      if (!state.live) {
        if (Math.abs(moved.clientX - state.startX) < TAB_DRAG_THRESHOLD_PX) return;
        state.live = true;
        state.from = items().indexOf(el);
        state.to = state.from;
        try { el.setPointerCapture(pointerId); } catch {}
        doc.getSelection()?.removeAllRanges();
        el.style.transition = "none";
        el.style.backgroundColor = opaqueBackground(el);
        el.setAttribute("data-tab-dragging", "");
      }
      const next = target();
      if (next !== state.to) { state.to = next; setPreview({ dragId: id, toIndex: next }); }
      place();
    };
    const up = (released) => { if (released.pointerId === pointerId) finish(true); };
    const cancelled = (lost) => { if (lost.pointerId === pointerId) finish(false); };
    const otherPress = (press) => { if (press.pointerId !== pointerId) finish(false); };
    const blur = () => finish(false);
    const key = (pressed) => { if (pressed.key === "Escape" && state.live) { pressed.preventDefault(); pressed.stopPropagation(); finish(false); } };
    const swallowMenu = (menu) => { if (state.live) { menu.preventDefault(); menu.stopPropagation(); } };
    state.cleanup = () => {
      doc.removeEventListener("pointermove", move);
      doc.removeEventListener("pointerup", up);
      doc.removeEventListener("pointercancel", cancelled);
      doc.removeEventListener("pointerdown", otherPress, true);
      doc.removeEventListener("keydown", key, true);
      doc.removeEventListener("contextmenu", swallowMenu, true);
      doc.removeEventListener("auxclick", swallowMenu, true);
      win.removeEventListener("blur", blur);
    };
    doc.addEventListener("pointermove", move);
    doc.addEventListener("pointerup", up);
    doc.addEventListener("pointercancel", cancelled);
    doc.addEventListener("pointerdown", otherPress, true);
    doc.addEventListener("keydown", key, true);
    doc.addEventListener("contextmenu", swallowMenu, true);
    doc.addEventListener("auxclick", swallowMenu, true);
    win.addEventListener("blur", blur);
    drag.current = state;
  }, [stripRef, place]);

  // The list in the order the drag shows (the dragged tab in its new slot), else as given.
  const order = useCallback((list, idOfItem = (item) => item) => (preview ? moveToIndex(list, preview.dragId, preview.toIndex, idOfItem) : list), [preview]);
  return { order, onPointerDown, draggingId: preview?.dragId ?? null };
}
