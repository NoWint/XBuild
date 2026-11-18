import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceTooltip } from "./source-tooltip";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { SourceSpinner } from "./source-pane-states.jsx";
import { SourceDialog } from "./source-dialog";
import { t } from "../electron/i18n/index.mjs";
import "./source-pane-sketch.css";

// The Preview pane's Annotate mode (2.2553.1 He in panes-tabs-current.js:1640-1890 over the sketch toolbar Nt of
// c467aa787-D4ORhe5w.js): a capture of the page fills the viewport, the marks are drawn on a canvas above it, and the
// floating toolbar at the bottom holds the tools (Pen, Line, Arrow, Rectangle, Ellipse), the four ink swatches,
// Undo / Redo / Clear all, Close and the "Add to chat" primary action. Close with marks asks "Discard your
// annotations?" (Keep editing focused). "Add to chat" composites the marks onto the capture at its own resolution.

export const SKETCH_TOOLS = ["pen", "line", "arrow", "rect", "ellipse"];
export const SKETCH_TOOL_LABELS = { pen: "Pen", line: "Line", arrow: "Arrow", rect: "Rectangle", ellipse: "Ellipse" };
// Tt: the ink colours, Red first (the default).
export const SKETCH_COLORS = [
  { value: "#E03131", label: "Red" },
  { value: "#1971C2", label: "Blue" },
  { value: "#2F9E44", label: "Green" },
  { value: "#1F1E1D", label: "Black" },
];
export const SKETCH_STROKE = 4;

// Undo history: past snapshots, the present list of marks, the undone ones.
export const emptyHistory = () => ({ past: [], present: [], future: [] });
export function commitMark(history, mark) {
  return { past: [...history.past, history.present], present: [...history.present, mark], future: [] };
}
export function undoHistory(history) {
  if (!history.past.length) return history;
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1], future: [history.present, ...history.future] };
}
export function redoHistory(history) {
  if (!history.future.length) return history;
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) };
}
export function clearHistory(history) {
  if (!history.present.length) return history;
  return { past: [...history.past, history.present], present: [], future: [] };
}

/** Draws marks (points normalised to 0..1 of the drawing box) onto a 2D context of width × height device pixels. */
export function drawMarks(context, marks, width, height, scale = 1) {
  for (const mark of marks) {
    const points = mark.points.map((point) => ({ x: point.x * width, y: point.y * height }));
    if (!points.length) continue;
    context.save();
    context.strokeStyle = mark.color;
    context.fillStyle = mark.color;
    context.lineWidth = SKETCH_STROKE * scale;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    const first = points[0], last = points[points.length - 1];
    if (mark.tool === "pen") {
      context.moveTo(first.x, first.y);
      if (points.length === 1) context.lineTo(first.x + 0.01, first.y);
      for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    } else if (mark.tool === "line" || mark.tool === "arrow") {
      context.moveTo(first.x, first.y);
      context.lineTo(last.x, last.y);
      if (mark.tool === "arrow") {
        const angle = Math.atan2(last.y - first.y, last.x - first.x), head = Math.max(10, SKETCH_STROKE * 3.5) * scale;
        for (const side of [-1, 1]) {
          context.moveTo(last.x, last.y);
          context.lineTo(last.x - head * Math.cos(angle + side * Math.PI / 6), last.y - head * Math.sin(angle + side * Math.PI / 6));
        }
      }
    } else if (mark.tool === "rect") {
      context.rect(Math.min(first.x, last.x), Math.min(first.y, last.y), Math.abs(last.x - first.x), Math.abs(last.y - first.y));
    } else if (mark.tool === "ellipse") {
      context.ellipse((first.x + last.x) / 2, (first.y + last.y) / 2, Math.abs(last.x - first.x) / 2, Math.abs(last.y - first.y) / 2, 0, 0, Math.PI * 2);
    }
    context.stroke();
    context.restore();
  }
}

/** The drawing box for a capture of width × height device pixels in a stage of stageWidth × stageHeight CSS px. */
export function fitBox({ width, height }, stageWidth, stageHeight, dpr = 1) {
  if (!(width > 0 && height > 0 && stageWidth > 0 && stageHeight > 0)) return null;
  const scale = Math.min(stageWidth / width, stageHeight / height, 1 / (dpr || 1));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// _t / vt / yt / bt: the custom 16px glyphs of the shape tools (Pen is the Edit glyph).
const TOOL_PATHS = {
  line: "M3.5 12.5L12.5 3.5",
  arrow: "M5.5 3.5H12.5V10.5M3.5 12.5L12.5 3.5",
  rect: "M4.25 3.5H11.75A0.75 0.75 0 0 1 12.5 4.25V11.75A0.75 0.75 0 0 1 11.75 12.5H4.25A0.75 0.75 0 0 1 3.5 11.75V4.25A0.75 0.75 0 0 1 4.25 3.5Z",
};
function ToolGlyph({ tool }) {
  if (tool === "pen") return <Icon name="Edit" size={16} />;
  return (
    <svg aria-hidden="true" data-cds="Icon" className="sps-glyph" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      {tool === "ellipse" ? <circle cx="8" cy="8" r="4.5" /> : <path d={TOOL_PATHS[tool]} />}
    </svg>
  );
}

// Ghost icon-only Buttons (the pane header's source-icon-button): pressed tools read accent.
function ToolbarButton({ label, icon, disabledReason, shortcut, children, ...props }) {
  return (
    <SourceTooltip content={label} shortcut={shortcut} disabledReason={props.disabled ? disabledReason : undefined} side="top" hoverable={false}>
      <button type="button" className="source-icon-button spc-ghost sps-button" aria-label={label} onMouseDown={(event) => event.preventDefault()} {...props}>
        {children ?? <Icon name={icon} size={16} />}
      </button>
    </SourceTooltip>
  );
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(t("Couldn’t save your annotations. Try again.")));
  image.src = src;
});
const canvasBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(t("Couldn’t save your annotations. Try again.")))), "image/png"));

/**
 * @param {object} props
 * @param {{src: string, width: number, height: number} | null | undefined} props.backdrop  the page capture; undefined while it loads, null when none
 * @param {() => void} props.onCancel
 * @param {(file: File, info: {annotated: boolean}) => void} props.onAttach
 * @param {(message: string) => void} [props.onError]
 */
export const SourcePaneSketch = forwardRef(function SourcePaneSketch({ backdrop, onCancel, onAttach, onError }, ref) {
  const root = useRef(null);
  const box = useRef(null);
  const canvas = useRef(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(SKETCH_COLORS[0].value);
  const [history, setHistory] = useState(emptyHistory);
  const [draft, setDraft] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const keep = useRef(null);
  const marks = history.present;
  const hasMarks = marks.length > 0;
  const requestClose = useCallback(() => { if (hasMarks) setConfirm(true); else onCancel(); }, [hasMarks, onCancel]);
  useImperativeHandle(ref, () => ({ hasMarks: () => hasMarks, requestClose }), [hasMarks, requestClose]);
  useEffect(() => { root.current?.focus({ preventScroll: true }); }, []);

  // Paint: the canvas is the box's size in device pixels.
  useLayoutEffect(() => {
    const node = canvas.current, frame = box.current;
    if (!node || !frame) return undefined;
    const paint = () => {
      const dpr = window.devicePixelRatio || 1, width = Math.max(1, Math.round(frame.clientWidth * dpr)), height = Math.max(1, Math.round(frame.clientHeight * dpr));
      if (node.width !== width) node.width = width;
      if (node.height !== height) node.height = height;
      const context = node.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, width, height);
      drawMarks(context, draft ? [...marks, draft] : marks, width, height, dpr);
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [marks, draft, backdrop]);

  const pointAt = (event) => {
    const rect = box.current.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / (rect.width || 1))), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / (rect.height || 1))) };
  };
  const down = (event) => {
    if (event.button !== 0 || saving) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = pointAt(event);
    setDraft({ tool, color, points: tool === "pen" ? [point] : [point, point], pointerId: event.pointerId });
  };
  const move = (event) => {
    if (!draft || draft.pointerId !== event.pointerId) return;
    const point = pointAt(event);
    setDraft((current) => (current ? { ...current, points: current.tool === "pen" ? [...current.points, point] : [current.points[0], point] } : current));
  };
  const up = (event) => {
    if (!draft || draft.pointerId !== event.pointerId) return;
    const { pointerId, ...mark } = draft;
    setDraft(null);
    const [first, last] = [mark.points[0], mark.points[mark.points.length - 1]];
    if (mark.tool !== "pen" && Math.hypot(last.x - first.x, last.y - first.y) < 0.002) return;
    setHistory((current) => commitMark(current, mark));
  };

  const attach = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const image = backdrop?.src ? await loadImage(backdrop.src) : null;
      const frame = box.current;
      const width = image?.naturalWidth || Math.round((frame?.clientWidth || 1) * (window.devicePixelRatio || 1));
      const height = image?.naturalHeight || Math.round((frame?.clientHeight || 1) * (window.devicePixelRatio || 1));
      const output = document.createElement("canvas");
      output.width = width; output.height = height;
      const context = output.getContext("2d");
      if (!context) throw new Error(t("Couldn’t save your annotations. Try again."));
      if (image) context.drawImage(image, 0, 0, width, height);
      else { context.fillStyle = "#ffffff"; context.fillRect(0, 0, width, height); }
      drawMarks(context, marks, width, height, width / Math.max(1, frame?.clientWidth || width));
      const blob = await canvasBlob(output);
      onAttach(new File([blob], hasMarks ? "preview-annotation.png" : "preview-screenshot.png", { type: "image/png" }), { annotated: hasMarks });
    } catch (error) {
      setSaving(false);
      onError?.(error?.message || t("Couldn’t save your annotations. Try again."));
    }
  };

  const onKeyDown = (event) => {
    if (event.nativeEvent.isComposing) return;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && !event.altKey && event.key.toLowerCase() === "z") {
      event.preventDefault(); event.stopPropagation();
      setHistory((current) => (event.shiftKey ? redoHistory(current) : undoHistory(current)));
    } else if (event.key === "Escape" && !mod && !event.shiftKey && !event.altKey && !confirm) {
      event.preventDefault(); event.stopPropagation();
      if (draft) setDraft(null); else requestClose();
    }
  };

  // The capture keeps its aspect: contained in the stage, top-centred, never above its CSS-pixel size.
  const stage = useRef(null);
  const [fit, setFit] = useState(null);
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node || !backdrop?.width || !backdrop?.height) { setFit(null); return undefined; }
    const measure = () => setFit(fitBox(backdrop, node.clientWidth, node.clientHeight, window.devicePixelRatio || 1));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [backdrop]);

  const loading = backdrop === undefined;
  return (
    <div ref={root} className="sps-root" tabIndex={-1} onKeyDown={onKeyDown} data-preview-sketch="">
      {backdrop === null && <div className="sps-blank" />}
      {loading
        ? <div className="sps-loading" role="status"><SourceSpinner size="lg" /><span className="source-sr-only">{t("Loading")}</span></div>
        : (
          <div ref={stage} className="sps-stage">
            <div ref={box} className="sps-box" style={fit ?? undefined}>
              {backdrop?.src && <img className="sps-image" src={backdrop.src} alt="" draggable={false} />}
              <canvas ref={canvas} className="sps-canvas" data-tool={tool} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDraft(null)} />
            </div>
          </div>
        )}
      <div className="sps-dock">
        <div className="sps-toolbar" role="toolbar" aria-label={t("Annotate")}>
          <div role="group" aria-label={t("Annotation tool")} className="sps-group">
            {SKETCH_TOOLS.map((name) => (
              <ToolbarButton key={name} label={t(SKETCH_TOOL_LABELS[name])} aria-pressed={name === tool} data-sketch-tool={name} onClick={() => setTool(name)}>
                <ToolGlyph tool={name} />
              </ToolbarButton>
            ))}
          </div>
          <span className="sps-separator" aria-hidden="true" />
          <div role="group" aria-label={t("Ink color")} className="sps-group sps-swatches">
            {SKETCH_COLORS.map((swatch) => (
              <SourceTooltip key={swatch.value} content={t(swatch.label)} side="top" hoverable={false}>
                <button type="button" className="sps-swatch" aria-label={t(swatch.label)} aria-pressed={swatch.value === color} onMouseDown={(event) => event.preventDefault()} onClick={() => setColor(swatch.value)}>
                  <span aria-hidden="true" className="sps-swatch-fill" style={{ background: swatch.value }} />
                </button>
              </SourceTooltip>
            ))}
          </div>
          <span className="sps-separator" aria-hidden="true" />
          <div className="sps-group sps-history">
            <ToolbarButton label={t("Undo")} icon="ArrowCounterClockwise" shortcut="cmd+z" disabled={!history.past.length} disabledReason={t("Nothing to undo yet")} onClick={() => setHistory(undoHistory)} />
            <ToolbarButton label={t("Redo")} icon="ArrowClockwise" shortcut="cmd+shift+z" disabled={!history.future.length} disabledReason={t("Nothing to redo yet")} onClick={() => setHistory(redoHistory)} />
            <ToolbarButton label={t("Clear all")} icon="Trash" disabled={!hasMarks} disabledReason={t("Nothing to clear yet")} onClick={() => setHistory(clearHistory)} />
          </div>
          <SourceSettingsButton variant="ghost" onMouseDown={(event) => event.preventDefault()} onClick={requestClose}>{t("Close")}</SourceSettingsButton>
          <SourceSettingsButton variant="primary" disabled={!hasMarks && !backdrop?.src} busy={saving} data-sketch-attach="" onClick={attach}>{t("Add to chat")}</SourceSettingsButton>
        </div>
      </div>
      <SourceDialog open={confirm} alert size="sm" showClose={false} title={t("Discard your annotations?")}
        description={t("You have unsaved marks on this image. Discarding removes them.")} initialFocusRef={keep} onClose={() => setConfirm(false)}
        footer={<>
          <SourceSettingsButton ref={keep} variant="secondary" onClick={() => setConfirm(false)}>{t("Keep editing")}</SourceSettingsButton>
          <SourceSettingsButton variant="danger" onClick={() => { setConfirm(false); onCancel(); }}>{t("Discard")}</SourceSettingsButton>
        </>} />
    </div>
  );
});
