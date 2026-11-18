// Shared with the main process preference validator; see electron/transcript-view-model.mjs.
export * from "../electron/transcript-view-model.mjs";
import { TRANSCRIPT_VIEWS, effectiveView } from "../electron/transcript-view-model.mjs";

/** cycleTranscriptMode ctrl+o (shared-21-D098Wd--.js:14189; code-workspace.js:2273-2280 _e): qa
 * (panes-state-current.js:584 Dt: normal, thinking, verbose) filtered to the views that survive Xa
 * for this session (Thinking needs reasoning), then the one after the effective current view. */
export function nextTranscriptView(current, { hasThinking = false } = {}) {
  const views = TRANSCRIPT_VIEWS.filter((view) => effectiveView(view, undefined, { hasThinking }) === view);
  const at = views.indexOf(effectiveView(current, undefined, { hasThinking }));
  return views[(at + 1) % views.length];
}
