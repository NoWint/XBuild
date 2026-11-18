// A request to show one file's section in the Changes pane (the per-turn edits card's file rows, Vpe x8 onOpen → by(path)).
// The pane may not be mounted yet when the request is made, so the latest request waits here until a Changes diff
// that lists a matching file takes it. Paths may be absolute (a core's fileChange) while the diff's are relative to
// the repository or the session folder: the longest diff path that the request ends with wins.

let pending = null;
const listeners = new Set();

/** The diff path a request names, or null. Pure. */
export function matchDiffPath(request, paths) {
  const wanted = typeof request === "string" ? request.replace(/^\.\//, "") : "";
  if (!wanted) return null;
  let best = null;
  for (const path of paths || []) {
    if (typeof path !== "string" || !path) continue;
    if (path === wanted) return path;
    if ((wanted.endsWith(`/${path}`) || path.endsWith(`/${wanted}`)) && (!best || path.length > best.length)) best = path;
  }
  return best;
}

export function requestDiffReveal(path) {
  if (typeof path !== "string" || !path) return;
  pending = { path, at: Date.now() };
  for (const listener of [...listeners]) listener();
}

/** The waiting request's matching path among `paths`, consuming it; null when none matches (it keeps waiting). */
export function takeDiffReveal(paths) {
  if (!pending) return null;
  // A request nobody could take (the pane showed another scope) does not linger into a later visit.
  if (Date.now() - pending.at > 10000) { pending = null; return null; }
  const match = matchDiffPath(pending.path, paths);
  if (match) pending = null;
  return match;
}

export function subscribeDiffReveal(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tests only. */
export function resetDiffReveal() { pending = null; listeners.clear(); }
