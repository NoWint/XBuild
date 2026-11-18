import { t, tn } from "../electron/i18n/index.mjs";

// "Commits" section of the Changed files column, 2.31226.0 c44d00c7f (readable
// analysis/code-ui-sync-20261013/readable/c44d00c7f-Buwpp1mI.js.readable.js):
// Wr commit row (808-881), Gr "Copy commit SHA" (882-910), Kr "All changes" /
// "Uncommitted changes" rows (911-931), qr the vertical toolbar (932-1002), Zr the
// collapsible header (1003-1057), zr roving keys (727-774), Ur click-after-drag
// guard (787-807); mounted under the file tree at ~7210 ("flex shrink-0 flex-col
// border-t", maxHeight 40%) only when there are commits and a commit picker.
// Collapsed state: ca80fca8d Rw, localStorage "epitaxy-diff-commits-collapsed"
// (default false), kept here in the tile store as diffCommitsCollapsed.

export const COMMITS_SECTION_LIMIT = 100;
export const COMMIT_ROW_SELECTOR = "[data-commit-row]";
// Ur Hr: a click that ends ≥4px from its mousedown over selected row text was a drag-select.
export const COMMIT_ROW_DRAG_PX = 4;

export const DIFF_COMMITS_LABELS = Object.freeze({
  commits: t("Commits"),
  allChanges: t("All changes"),
  uncommitted: t("Uncommitted changes"),
  noMessage: t("(no message)"),
  copySha: t("Copy commit SHA"),
  copied: t("Commit SHA copied to clipboard."),
  copyFailed: t("Couldn’t copy to the clipboard."),
});

// ce9ca5630 i/a/c (f, m, p): the file-tree row base, selected and idle fills (shared with Ya/Ja rows).
export const COMMIT_ROW_ACTIVE = "bg-fill-control hover:bg-fill-control text-primary";
export const COMMIT_ROW_IDLE = "bg-alpha-0 text-primary hover:bg-fill-ghost-hover data-[pressed]:bg-fill-ghost-hover";
export const COMMITS_HEADER_ROW = "flex items-center gap-1 h-control pr-md rounded text-body text-left w-full select-none focus-visible:outline-hidden hide-focus-ring focus-visible:shadow-focus";
export const COMMIT_ROW_CLASS = "group flex w-full flex-col items-start gap-[2px] rounded px-xs py-[6px] text-left text-body focus-visible:outline-hidden hide-focus-ring focus-visible:shadow-focus";
export const SCOPE_ROW_CLASS = "scroll-mt-(--cds-pad-md) rounded px-xs py-[6px] text-left text-body focus-visible:outline-hidden hide-focus-ring focus-visible:shadow-focus";
export const COMMITS_TOOLBAR_CLASS = "flex flex-col gap-0.5 pb-md outline-none hide-focus-ring";

/** qr: the newest 100 commits; a selected commit past them is appended; `hidden` counts the
 * rest of base..HEAD (`total` = rev-list --count when known, else the rows given). */
export function commitsSectionRows(commits, selectedSha = null, total) {
  const list = Array.isArray(commits) ? commits : [];
  const shown = list.length > COMMITS_SECTION_LIMIT ? list.slice(0, COMMITS_SECTION_LIMIT) : list;
  const extra = selectedSha !== null && !shown.some((commit) => commit.sha === selectedSha)
    ? list.find((commit) => commit.sha === selectedSha) : undefined;
  const rows = extra ? [...shown, extra] : shown;
  const all = Number.isSafeInteger(total) && total >= list.length ? total : list.length;
  return { rows, hidden: Math.max(0, all - rows.length) };
}

export function olderCommitsLabel(hidden) {
  return tn(hidden, "{count} older commit not shown", "{count} older commits not shown");
}

/** zr ArrowDown/ArrowUp/Home/End: from no focused row, the pressed (else first) row. */
export function commitRowTarget(key, { index, count, pressedIndex = -1 }) {
  if (count <= 0) return null;
  const start = pressedIndex >= 0 ? pressedIndex : 0;
  switch (key) {
    case "ArrowDown": return index < 0 ? start : Math.min(index + 1, count - 1);
    case "ArrowUp": return index < 0 ? start : Math.max(index - 1, 0);
    case "Home": return 0;
    case "End": return count - 1;
    default: return null;
  }
}

/** Ur: a real (detail > 0) click is dropped when the pointer travelled ≥4px since mousedown and
 * a non-empty selection intersects the row (Vr), so drag-selecting a subject does not pick it. */
export function isDragSelectClick({ detail, start, end, hasSelection }) {
  return detail > 0 && start !== null && start !== undefined
    && Math.hypot(end.x - start.x, end.y - start.y) >= COMMIT_ROW_DRAG_PX && !!hasSelection;
}

/** Wr meta line: shortSha · authorName [· narrow relative date when date > 0 (Unix seconds)]. */
export function commitMeta(commit) {
  return {
    shortSha: commit?.shortSha ?? String(commit?.sha ?? "").slice(0, 7),
    author: commit?.authorName ?? "",
    dateMs: Number.isFinite(commit?.date) && commit.date > 0 ? commit.date * 1000 : null,
  };
}
