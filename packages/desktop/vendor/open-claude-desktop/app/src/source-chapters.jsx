// Session chapters: the chapter heading (cd5a31703 CX/wX/SX, readable 60429-60494), the title reveal it animates
// with (shared-21 M9, readable 30502-30560) and the Session chapters rail (cf74bc599 tb/nb/eb, readable 3187-3520),
// over the per-session chapter store in session-chapters-model.mjs.
import React, { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { SourceMenu } from "./source-menu.jsx";
import {
  CHAPTER_READING_OFFSET, CHAPTER_SAMPLE_THROTTLE_MS, EMPTY_CHAPTER_STATE, activeChapterId, chapterAnchorId,
  chapterStore, chapterView, deferChapterSample, hasChapters, sessionChapterState,
} from "./session-chapters-model.mjs";
import "./source-chapters.css";
import { t } from "../electron/i18n/index.mjs";

const serverSnapshot = () => EMPTY_CHAPTER_STATE;
/** The whole chapter store (Hw). */
export function useChapterStoreState() {
  const store = chapterStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
}
/** One session's {renames, hidden, userChapters}. */
export function useSessionChapterState(sessionId) {
  return sessionChapterState(useChapterStoreState(), sessionId);
}

// M9 (shared-21 :30502): jce 30ms per grapheme, Mce 4 graphemes of tail, A9 200ms blur-out.
const GRAPHEME_STEP_MS = 30, GRAPHEME_TAIL = 4, BLUR_MS = 200;
const BLUR_TRANSITION = `opacity ${BLUR_MS}ms ease-out, filter ${BLUR_MS}ms ease-out`;
const BLUR_OUT = { opacity: 0, filter: "blur(6px)", transition: BLUR_TRANSITION };
const BLUR_IN = { transition: BLUR_TRANSITION };
let segmenter;
/** qg: a title's graphemes. */
export function titleGraphemes(text) {
  const value = String(text ?? "");
  try {
    segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), (part) => part.segment);
  } catch {
    return Array.from(value);
  }
}

/** M9: a title that blurs out and reveals its new text grapheme by grapheme when it changes. */
export function SourceTitleReveal({ text, skipInitialReveal = false }) {
  const [shown, setShown] = useState(text);
  const [phase, setPhase] = useState("initial");
  const [revealed, setRevealed] = useState(null);
  const graphemes = useMemo(() => titleGraphemes(shown), [shown]);
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(shown), (graphemes.length + GRAPHEME_TAIL) * GRAPHEME_STEP_MS);
    return () => clearTimeout(timer);
  }, [shown, graphemes.length]);
  const done = revealed === shown;
  if (text !== shown && phase !== "out" && (phase === "initial" || done)) setPhase("out");
  const latest = useRef(text);
  latest.current = text;
  useEffect(() => {
    if (phase !== "out") return undefined;
    const timer = setTimeout(() => {
      if (latest.current === shown) { setPhase("recover"); return; }
      setShown(latest.current);
      setPhase("idle");
    }, BLUR_MS);
    return () => clearTimeout(timer);
  }, [phase, shown]);
  if (skipInitialReveal && phase === "initial") return text;
  return <>
    <span className="sch-sr-only">{text}</span>
    <span key={shown} aria-hidden="true" data-revealing={done ? undefined : ""} className="sch-reveal"
      style={phase === "initial" || phase === "idle" ? undefined : phase === "out" && text !== shown ? BLUR_OUT : BLUR_IN}>
      {graphemes.map((grapheme, index) => <span key={index} className="sch-grapheme" style={{ "--i": `${index}` }}>{grapheme === " " ? " " : grapheme}</span>)}
    </span>
  </>;
}

/** SX: the heading's title — a change reveals, and 1.5s later the heading settles back to plain text. */
function ChapterHeadingText({ text }) {
  const last = useRef(text);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (text === last.current) return undefined;
    last.current = text;
    const timer = setTimeout(() => setGeneration((value) => value + 1), 1500);
    return () => clearTimeout(timer);
  }, [text]);
  return <SourceTitleReveal key={generation} text={text} skipInitialReveal />;
}

/**
 * CX: the chapter h2 (text-body-semibold text-primary select-text scroll-mt-[56px]). A double-click renames it in
 * place: a field-sized input with the outline-fill-accent ring; Enter or blur saves a changed, non-empty title,
 * Escape cancels. itemId keeps a mark_chapter heading addressable as its transcript row.
 */
export const SourceChapterHeading = memo(function SourceChapterHeading({ id, title, sessionId = null, itemId = undefined, source = "claude" }) {
  const [editing, setEditing] = useState(false);
  const input = useRef(null), settled = useRef(false);
  useEffect(() => {
    if (!editing) return;
    settled.current = false;
    input.current?.select();
  }, [editing]);
  const commit = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    const value = input.current?.value.trim();
    if (sessionId && value && value !== title) chapterStore().rename(sessionId, id, value);
    setEditing(false);
  }, [sessionId, id, title]);
  const shared = { id: chapterAnchorId(id), className: "source-message source-chapter", "data-chapter": "", "data-chapter-source": source,
    "data-transcript-item-id": itemId };
  if (editing) return <h2 {...shared} data-editing="">
    <input ref={input} className="source-chapter-input" defaultValue={title} aria-label={t("Chapter title")}
      size={Math.min(Math.max(title.length, 10), 40)} onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); commit(); }
        else if (event.key === "Escape") { event.preventDefault(); settled.current = true; setEditing(false); }
      }} />
  </h2>;
  return <h2 {...shared} aria-hidden={title === "" || undefined}
    onDoubleClick={sessionId && title !== "" ? () => setEditing(true) : undefined}>
    <ChapterHeadingText text={title} />
  </h2>;
});

/** wX: a mark_chapter heading, unless the rail deleted (hid) it; a rename wins over the tool's title. */
export const SourceClaudeChapter = memo(function SourceClaudeChapter({ sessionId, id, title, itemId }) {
  const state = useChapterStoreState();
  const { hidden, renamedTitle } = chapterView(state, sessionId, id);
  return hidden ? null : <SourceChapterHeading id={id} title={renamedTitle ?? title} sessionId={sessionId} itemId={itemId} />;
});

/** eb: the chapter at the reading line, sampled on scroll (one frame per sample; near the bottom at most every 50ms). */
export function useActiveChapter(chapters, viewportRef, scrollKey) {
  const [active, setActive] = useState(null);
  const visible = hasChapters(chapters);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !visible) return undefined;
    const view = viewport.ownerDocument.defaultView ?? globalThis;
    let frame = 0, timer = 0, retried = false, lastSampleAt = -Infinity, lastDistance = 0;
    const sample = () => {
      frame = 0;
      if (timer) { view.clearTimeout(timer); timer = 0; }
      const first = viewport.querySelector("[data-transcript-item-id]");
      if (!first) {
        if (!retried) { retried = true; frame = view.requestAnimationFrame(sample); }
        return;
      }
      lastSampleAt = view.performance.now();
      const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      lastDistance = distance;
      const top = viewport.getBoundingClientRect().top + CHAPTER_READING_OFFSET;
      const next = activeChapterId(chapters, {
        canScroll: viewport.scrollHeight > viewport.clientHeight,
        distanceToBottomPx: distance,
        viewportTopPx: top,
        // Every displayed row (and so every heading) is in the DOM here: the transcript is not virtualized, so the
        // first-visible-entry fallback for an unmounted heading is not needed.
        firstEntryIndex: -1,
        getAnchorTop: (chapter) => viewport.querySelector(`#${CSS.escape(chapterAnchorId(chapter.id))}`)?.getBoundingClientRect().top ?? null,
      });
      setActive((value) => value === next ? value : next);
    };
    const onScroll = () => {
      if (frame) return;
      if (deferChapterSample(view.performance.now(), lastSampleAt, lastDistance)) {
        timer ||= view.setTimeout(() => { timer = 0; frame ||= view.requestAnimationFrame(sample); }, CHAPTER_SAMPLE_THROTTLE_MS);
        return;
      }
      frame = view.requestAnimationFrame(sample);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    sample();
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      if (frame) view.cancelAnimationFrame(frame);
      if (timer) view.clearTimeout(timer);
    };
  }, [viewportRef, scrollKey, chapters, visible]);
  return active;
}

/** nb: one chapter in the open rail — jump on click, rename on double-click or Rename, Delete in its context menu. */
const ChapterEntry = memo(function ChapterEntry({ chapter, sessionId, isActive, isEditing, onJump, onStartRename, onContextMenuOpenChange }) {
  const input = useRef(null), settled = useRef(false), button = useRef(null);
  const [menuPoint, setMenuPoint] = useState(null);
  useEffect(() => {
    if (!isEditing) return;
    settled.current = false;
    input.current?.select();
  }, [isEditing]);
  const commit = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    const value = input.current?.value.trim();
    if (sessionId && value && value !== chapter.title) chapterStore().rename(sessionId, chapter.id, value);
    onStartRename(null);
  }, [sessionId, chapter.id, chapter.title, onStartRename]);
  if (isEditing) return <li className="sch-toc-entry sch-toc-editing">
    <span aria-hidden="true" className="sch-toc-mark sch-toc-mark-edit" />
    <input ref={input} className="sch-toc-input" defaultValue={chapter.title} aria-label={t("Chapter title")} onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); commit(); }
        else if (event.key === "Escape") { event.preventDefault(); settled.current = true; onStartRename(null); }
      }} />
  </li>;
  const session = chapter.source === "session";
  const closeMenu = () => { setMenuPoint(null); onContextMenuOpenChange(false); };
  return <li>
    <button ref={button} type="button" className="sch-toc-entry sch-toc-button" data-active={isActive ? "" : undefined}
      aria-current={isActive ? "true" : undefined} title={chapter.summary} onClick={() => onJump(chapter)}
      onDoubleClick={session ? undefined : () => onStartRename(chapter.id)}
      onContextMenu={session ? undefined : (event) => {
        event.preventDefault();
        setMenuPoint({ x: event.clientX, y: event.clientY });
        onContextMenuOpenChange(true);
      }}>
      <span aria-hidden="true" className="sch-toc-mark" />
      <span className="sch-toc-title"><SourceTitleReveal text={chapter.title} /></span>
    </button>
    {menuPoint && <SourceMenu.Popup anchor={button.current} point={menuPoint} dataCds="ContextMenu" layer="contextmenu"
      label={chapter.title} onClose={closeMenu}>
      <SourceMenu.Item onClick={() => onStartRename(chapter.id)}>{t("Rename")}</SourceMenu.Item>
      <SourceMenu.Separator />
      <SourceMenu.Item variant="danger" onClick={() => {
        if (!sessionId) return;
        if (chapter.source === "user") chapterStore().removeUserChapter(sessionId, chapter.id);
        else chapterStore().setHidden(sessionId, chapter.id, true);
      }}>{t("Delete")}</SourceMenu.Item>
    </SourceMenu.Popup>}
  </li>;
});

/**
 * tb: the Session chapters rail at the transcript's left gutter — one short line per chapter (the current one longer
 * and darker); hovering or focusing it opens the chapter list over the gutter. onJump(chapter) scrolls to a heading
 * (Session start scrolls to the top).
 */
export const SourceChapterToc = memo(function SourceChapterToc({ sessionId, chapters, viewportRef, scrollKey, onJump }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditingState] = useState(null);
  const editingRef = useRef(false), menuOpen = useRef(false), nav = useRef(null);
  const setEditing = useCallback((id) => { editingRef.current = id !== null; setEditingState(id); }, []);
  const active = useActiveChapter(chapters, viewportRef, scrollKey);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => {
    if (menuOpen.current || editingRef.current) return;
    setOpen(false);
    setEditing(null);
  }, [setEditing]);
  const onMenuOpenChange = useCallback((value) => {
    menuOpen.current = value;
    if (!value) requestAnimationFrame(() => { if (nav.current && !nav.current.matches(":hover")) hide(); });
  }, [hide]);
  const jump = useCallback((chapter) => onJump?.(chapter), [onJump]);
  if (!hasChapters(chapters)) return null;
  return <div className="epitaxy-toc sch-toc" data-shown={active === null ? undefined : ""}>
    <nav ref={nav} aria-label={t("Session chapters")} tabIndex={0} className="sch-toc-nav" onMouseLeave={hide} onFocus={show}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) hide(); }}>
      <ol aria-hidden="true" className="sch-toc-rail" onMouseEnter={show}>
        {chapters.map((chapter) => <li key={chapter.id} className="sch-toc-tick">
          <span className="sch-toc-line" data-active={chapter.id === active ? "" : undefined} />
        </li>)}
      </ol>
      <div className="sch-toc-popover" data-open={open ? "" : undefined}>
        <ol role="list" className="sch-toc-list">
          {chapters.map((chapter) => <ChapterEntry key={chapter.id} chapter={chapter} sessionId={sessionId}
            isActive={chapter.id === active} isEditing={chapter.id === editing} onJump={jump} onStartRename={setEditing}
            onContextMenuOpenChange={onMenuOpenChange} />)}
        </ol>
      </div>
    </nav>
  </div>;
});
