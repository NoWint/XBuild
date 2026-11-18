import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { SourceTooltip } from "./source-tooltip";
import { fileKindIcon } from "./file-kind-icon.mjs";
import { positionMenu } from "./menu-model.mjs";
import { parseUnifiedDiff } from "./diff-model";
import { diffFileEntries } from "./diff-file-list-model.mjs";
import { requestDiffReveal } from "./diff-reveal.mjs";
import { GO_TO_FILE_SHORTCUT, goToFileItems, goToFileSide, isGoToFileShortcut } from "./diff-go-to-file-model.mjs";
import { t, tn } from "../electron/i18n/index.mjs";
import "./source-select.css";
import "./source-pane-go-to-file.css";

// The Changes header's "Go to file" (2.2553.1 panes-tile-current.js nh :3222-3390): a ghost square Search trigger
// (Ut tooltip with the ⌘P keycap, goToDiffFile) opening a CDS Combobox popup, w-[22rem] max-w-[calc(100vw-16px)],
// align end, its side chosen on open (eh) and kept: PopupSearch "Search changed files", the matches (file kind
// icon, the Pc name-then-folder path with the matched characters in font-semibold text-primary, the +N −N counts),
// "No matching files", and "{count} more files. Keep typing to narrow." past 100 rows. Choosing a path scrolls its
// section into view (oo.scrollToAnnotation → onPick). ⌘P opens it while focus is anywhere inside the pane.

function Lit({ text, positions, offset }) {
  if (!positions?.length) return text;
  const parts = [];
  let at = 0, index = 0;
  while (index < positions.length && positions[index] < offset) index++;
  while (at < text.length) {
    if (index < positions.length && positions[index] === at + offset) {
      const start = at;
      while (index < positions.length && positions[index] === at + offset) { at++; index++; }
      parts.push(<span key={start} data-lit="" className="sgf-lit">{text.slice(start, at)}</span>);
    } else {
      const start = at;
      while (at < text.length && (index >= positions.length || positions[index] !== at + offset)) at++;
      parts.push(text.slice(start, at));
    }
  }
  return parts;
}

// Pc (c784da984 p): the file name (text-secondary while a match falls in it), then its folder in footnote muted.
function MatchPath({ path, positions }) {
  const cut = path.lastIndexOf("/");
  const folder = cut > 0 ? path.slice(0, cut) : cut === 0 ? "/" : "";
  const name = path.slice(cut + 1), offset = cut + 1;
  const inName = positions?.some((position) => position >= offset) ?? false;
  return <span dir="ltr" className="sgf-path" title={path}>
    <span className="sgf-name" data-matched={inName || undefined}><Lit text={name} positions={positions} offset={offset} /></span>
    {folder && <span className="sgf-folder"><span className="sgf-folder-text"><Lit text={folder} positions={positions} offset={0} /></span></span>}
  </span>;
}

function Counts({ additions, deletions }) {
  if (!Number.isFinite(additions) || !Number.isFinite(deletions)) return null;
  return <span className="sdiff-tree-counts sgf-counts">
    <span className="text-git-added">{`+${additions}`}</span><span className="text-git-removed">{`−${deletions}`}</span>
  </span>;
}

/**
 * patch: the Changes pane's unified diff (its files are listed); onPick(path): show that file's section (by default
 * the Changes diff's reveal request, diff-reveal.mjs).
 */
export function SourceDiffGoToFile({ patch, onPick = requestDiffReveal }) {
  const [open, setOpen] = useState(null);
  const trigger = useRef(null);
  const label = t("Go to file");
  useEffect(() => {
    const root = trigger.current?.closest(".source-file-panel");
    if (!root) return undefined;
    const keyDown = (event) => {
      if (!isGoToFileShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) setOpen({ token: Date.now(), side: goToFileSide(trigger.current?.getBoundingClientRect(), window.innerHeight) });
    };
    root.addEventListener("keydown", keyDown);
    return () => root.removeEventListener("keydown", keyDown);
  }, []);
  return <>
    <SourceTooltip content={label} shortcut={GO_TO_FILE_SHORTCUT} side="bottom" hoverable={false} open={open ? false : undefined}>
      <button ref={trigger} type="button" className="source-icon-button spc-ghost sgf-trigger" aria-label={label} aria-keyshortcuts="Meta+P"
        aria-haspopup="listbox" aria-expanded={!!open} data-go-to-file="" onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen(open ? null : { token: Date.now(), side: goToFileSide(trigger.current?.getBoundingClientRect(), window.innerHeight) })}>
        <Icon name="Search" size={16} />
      </button>
    </SourceTooltip>
    {open && <GoToFilePopup key={open.token} side={open.side} patch={patch} trigger={trigger}
      onClose={(restore) => { setOpen(null); if (restore) trigger.current?.focus({ preventScroll: true }); }}
      onPick={(path) => { setOpen(null); onPick?.(path); }} />}
  </>;
}

function GoToFilePopup({ side, patch, trigger, onClose, onPick }) {
  const id = useId();
  const entries = useMemo(() => diffFileEntries(parseUnifiedDiff(patch ?? "").sections), [patch]);
  const [query, setQuery] = useState("");
  const { items, more } = useMemo(() => goToFileItems(entries, query), [entries, query]);
  const [active, setActive] = useState(0);
  const popup = useRef(null), input = useRef(null), latest = useRef(onClose);
  latest.current = onClose;
  const [position, setPosition] = useState({ visibility: "hidden" });
  useEffect(() => { setActive(0); }, [query]);
  useLayoutEffect(() => {
    const owner = trigger.current, node = popup.current;
    if (!owner || !node) return undefined;
    const update = () => {
      const anchor = owner.getBoundingClientRect();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const width = Math.min(22 * rem, innerWidth - 16);
      node.style.width = `${width}px`;
      const placed = positionMenu({ anchor, size: { width, height: node.offsetHeight }, viewport: { width: innerWidth, height: innerHeight }, side, align: "end", sideOffset: 6 });
      const next = { left: placed.left, top: placed.top, width, visibility: "visible" };
      setPosition((old) => (Object.keys(next).every((key) => old[key] === next[key]) ? old : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, [trigger, side]);
  useLayoutEffect(() => { if (position.visibility === "visible") input.current?.focus({ preventScroll: true }); }, [position.visibility]);
  useLayoutEffect(() => { document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: "nearest" }); }, [active, id]);
  useEffect(() => {
    const outside = (event) => { if (!popup.current?.contains(event.target) && !trigger.current?.contains(event.target)) latest.current(false); };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("focusin", outside); };
  }, [trigger]);
  const owner = trigger.current;
  const attrs = {};
  for (const attr of ["data-density", "data-mode", "data-theme", "data-cds-theme", "data-font", "data-color-version"]) {
    const value = (owner?.closest(`[${attr}]`) ?? document.documentElement).getAttribute(attr);
    if (value != null) attrs[attr] = value;
  }
  const keyDown = (event) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) { event.stopPropagation(); return; }
    // ⌘P again inside the popup is swallowed (L: goToDiffFile → preventDefault).
    if (isGoToFileShortcut(event)) { event.preventDefault(); event.stopPropagation(); return; }
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); onClose(true); }
    else if (event.key === "Tab") { event.preventDefault(); onClose(true); }
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length) setActive((at) => (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[active] ?? items[0];
      if (item) onPick(item.value);
    }
  };
  return createPortal(<div {...attrs} className="sselect-portal cds-root" data-cds-portal="" style={{ zIndex: 120 }}>
    <div ref={popup} data-cds="Combobox" className="sselect-popup sgf-popup" data-side={side} style={position} onKeyDown={keyDown}>
      <div className="sselect-body">
        <input ref={input} className="sselect-search" role="combobox" aria-label={t("Search changed files")} placeholder={t("Search changed files")}
          aria-expanded="true" aria-controls={`${id}-list`} aria-autocomplete="list" aria-describedby={more > 0 ? `${id}-more` : undefined}
          aria-activedescendant={items[active] ? `${id}-option-${active}` : undefined}
          autoComplete="off" spellCheck={false} value={query} onChange={(event) => setQuery(event.target.value)} />
        <div id={`${id}-list`} role="listbox" aria-label={t("Search changed files")} tabIndex={-1} className="sselect-list scroll-fade-y sgf-list">
          {items.map((item, index) => <div key={item.value} id={`${id}-option-${index}`} role="option" aria-selected={index === active}
            data-highlighted={index === active || undefined} data-value={item.value} className="sselect-option sgf-option"
            onPointerMove={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => onPick(item.value)}>
            <span className="sgf-row">
              <Icon name={fileKindIcon(item.value)} size={12} className="sgf-icon" />
              <span className="sgf-path-slot"><MatchPath path={item.value} positions={item.positions} /></span>
              <Counts additions={item.additions} deletions={item.deletions} />
            </span>
          </div>)}
          {!items.length && <div className="sselect-empty">{t("No matching files")}</div>}
        </div>
        {more > 0 && <div id={`${id}-more`} className="sgf-more">{tn(more, "{count} more file. Keep typing to narrow.", "{count} more files. Keep typing to narrow.")}</div>}
      </div>
    </div>
  </div>, document.body);
}
