// B29 Action Center row hover card (shared-21 Vse = cc43287c9 Fm, lz :5520-5651; awaiting body ca0409d7c ue/V/fe).
// A "Needs input" row previews what the session waits on: the pending approval (its card title and the command or
// files), a question the agent asked, or, with nothing pending (a failed turn), V's 'Awaiting input · Open the session
// to respond'. Rows without a summary (unread) have no card, as Vse is disabled without one (disabled: !A && !S).
import { approvalCardModel, ELICITATION } from "./approval-card-model.mjs";
import { assistantName } from "./persona-store.mjs";
import { t } from "../electron/i18n/index.mjs";

export const AWAITING_OPEN_DELAY_MS = 400; // N_.Root delay: i ? 400 : 500
export const SUMMARY_OPEN_DELAY_MS = 500;
export const CLOSE_DELAY_MS = 200; // closeDelay
export const PREVIEW_CHARS = 280; // G: questions and summaries clip at 280 characters

const clip = (text) => (text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text);
const oneLine = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * The card body for a session's pending requests (oldest first, as they queue in the transcript):
 * {kind: "approval", title, detail, more} | {kind: "question", eyebrow, text, more} | {kind: "waiting"}.
 */
export function awaitingPreview(requests = []) {
  const list = Array.isArray(requests) ? requests.filter(Boolean) : [];
  const first = list[0];
  if (!first) return { kind: "waiting" };
  const more = list.length - 1;
  let model;
  try { model = approvalCardModel(first, null); } catch { return { kind: "waiting" }; }
  if (first.method === ELICITATION) {
    const text = oneLine(model.message) || oneLine(model.heading) || oneLine(model.title);
    if (!text) return { kind: "waiting" };
    return { kind: "question", eyebrow: t("{name} asked", { name: assistantName() }), text: clip(text), more };
  }
  if (!model?.supported) return { kind: "waiting" };
  const detail = oneLine(model.detail?.text);
  return { kind: "approval", title: model.title, detail: detail ? clip(detail) : null, more };
}

/** Vse disabled: an awaiting row always has a card; another row only with a summary text. */
export function hoverCardEnabled({ kind, summaryText } = {}) {
  return kind === "blocked" || !!oneLine(summaryText);
}
