import { useEffect, useRef, useState } from "react";

// Shared pointer lifecycle for the file-tree divider (and any single-axis
// drag). Escape/pointercancel restore the value captured by onStart; no
// partial drag is saved. focusOnStart false keeps focus where it is, like
// shared-19-CjdiaR4X.js Os (its mousedown preventDefault never focuses).
export function useSourcePointerResize({ onStart, onMove, onEnd, onCancel, focusOnStart = true }) {
  const callbacks = useRef({ onStart, onMove, onEnd, onCancel });
  callbacks.current = { onStart, onMove, onEnd, onCancel };
  const cleanup = useRef(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => () => cleanup.current?.(true, true), []);
  function onPointerDown(event) {
    if (event.button !== 0 || cleanup.current) return;
    event.preventDefault();
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const view = target.ownerDocument.defaultView;
    callbacks.current.onStart?.(event);
    if (focusOnStart) target.focus({ preventScroll: true });
    target.setPointerCapture?.(pointerId);
    setDragging(true);
    let delta = 0;
    const move = (e) => {
      if (e.pointerId !== pointerId) return;
      delta = e.clientX - startX;
      callbacks.current.onMove?.(delta);
    };
    const finish = (cancelled = false, unmounting = false) => {
      view.removeEventListener("pointermove", move);
      view.removeEventListener("pointerup", up);
      view.removeEventListener("pointercancel", cancel);
      view.removeEventListener("keydown", key, true);
      cleanup.current = null;
      if (target.hasPointerCapture?.(pointerId))
        target.releasePointerCapture(pointerId);
      if (unmounting) return;
      setDragging(false);
      if (cancelled) callbacks.current.onCancel?.();
      else callbacks.current.onEnd?.(delta);
    };
    const up = (e) => {
      if (e.pointerId === pointerId) finish();
    };
    const cancel = (e) => {
      if (e.pointerId === pointerId) finish(true);
    };
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        finish(true);
      }
    };
    cleanup.current = finish;
    view.addEventListener("pointermove", move);
    view.addEventListener("pointerup", up);
    view.addEventListener("pointercancel", cancel);
    view.addEventListener("keydown", key, true);
  }
  return { onPointerDown, dragging };
}
