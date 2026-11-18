// Pure home-page model (2.2553.1 draft home): greeting name, Action Center
// attention classification, row limits, stats range math, the compact token
// formatter, chart ticks, heatmap window and the book footnote. No DOM, no
// dates from thread.updatedAt: every aggregate reads the per-day stats only.
import { t } from "../electron/i18n/index.mjs";

export const ATTENTION_KINDS = Object.freeze({
  blocked: { label: t("Needs input") },
  unread: { label: t("Unread") },
});

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** zk(true, preferred): trim, e-mail → local part, empty → undefined. */
export function greetingName(preferred) {
  const name = typeof preferred === "string" ? preferred.trim() : "";
  if (!name) return undefined;
  return /^[^@\s]+@[^@\s]+$/.test(name) ? name.split("@")[0] : name;
}

/** Jk copy: landing clear asks "What’s up next"; otherwise "Welcome back". */
export function greetingText(name, landingClear) {
  if (landingClear) return name ? t("What’s up next, {name}?", { name }) : t("What’s up next?");
  return name ? t("Welcome back, {name}", { name }) : t("Welcome back");
}

/**
 * zR (cc43287c9 :4858-4886; shared-11 SM/Pk): archived or pinned sessions never
 * need attention, nor does a responding one. A pending approval is "blocked"
 * unless acknowledged (ackedAt >= session timestamp); a session whose last turn
 * failed (errorAt, main session-attention.cjs) is "blocked" until acknowledged
 * after the failure (ackedAt >= errorAt); an unread, unacknowledged session that
 * is not running is "unread". Local approvals arrive mid-turn, so "responding"
 * means running without a pending approval.
 */
export function classifyAttention(context) {
  if (context.archived || context.pinned) return null;
  const responding = !!context.running && !context.hasApproval;
  if (responding) return null;
  const errored = Number.isFinite(context.errorAt);
  // The failure is the session's latest activity (the source's session timestamp moves with it; a listed
  // thread's updatedAt can lag until the next list refresh).
  const timestamp = Math.max(number(context.timestamp), errored ? context.errorAt : -Infinity);
  const ackedAt = Number.isFinite(context.ackedAt) ? context.ackedAt : undefined;
  const acked = ackedAt !== undefined && ackedAt >= timestamp;
  const errorAcked = acked || (errored && ackedAt !== undefined && ackedAt >= context.errorAt);
  if ((!acked && context.hasApproval) || (errored && !errorAcked)) return "blocked";
  if (!acked && context.unread && !context.running) return "unread";
  return null;
}

/** O6 (shared-19): an acknowledgement covers the session's timestamp and its failure, whichever is later. */
export function acknowledgementTime(timestamp, errorAt) {
  const at = number(timestamp);
  return Number.isFinite(errorAt) ? Math.max(at, errorAt) : at;
}

/** D6 (shared-19): the session has a failure the user has not acknowledged yet. */
export function unackedError({ archived = false, errorAt, ackedAt, timestamp } = {}) {
  if (archived || !Number.isFinite(errorAt)) return false;
  if (!Number.isFinite(ackedAt)) return true;
  return !(ackedAt >= Math.max(number(timestamp), errorAt) || ackedAt >= errorAt);
}

/** Lk: blocked rows first, then the rest; each group newest first. */
export function sortAttention(rows) {
  const byTime = (a, b) => number(b.timestamp) - number(a.timestamp);
  return [
    ...rows.filter((row) => row.kind === "blocked").sort(byTime),
    ...rows.filter((row) => row.kind !== "blocked").sort(byTime),
  ];
}

export const ROW_LIMIT_HEIGHTS = Object.freeze([800, 900, 1000, 1100]);

/** Vk: 3 rows plus one per matched min-height breakpoint. */
export function rowLimit(viewportHeight) {
  const height = number(viewportHeight);
  return 3 + ROW_LIMIT_HEIGHTS.filter((step) => height >= step).length;
}

/** Zk: Sessions (and Projects) sections cap at five rows. */
export function sessionsLimit(viewportHeight) {
  return Math.min(rowLimit(viewportHeight), 5);
}

export function landingClear(shape) {
  return number(shape?.sessions) === 0 && number(shape?.projects) === 0 && number(shape?.prs) === 0;
}

export const RANGE_DAYS = Object.freeze({ all: null, "30d": 30, "7d": 7 });

export function localDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDayKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key));
  if (!match) throw new Error(`not a YYYY-MM-DD date key: ${key}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Pw: the range keeps `days` calendar days ending today (today minus days-1). */
export function rangeCutoff(range, todayKey) {
  const days = RANGE_DAYS[range];
  if (!days) return null;
  const date = parseDayKey(todayKey);
  date.setDate(date.getDate() - (days - 1));
  return localDayKey(date);
}

const ZERO_USAGE = Object.freeze({ inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 });

/**
 * Iw (code-home.js:13711-13751) over the original stats object (getCodeStats:
 * the DeepSeek core's codeDesktop/stats/read, or activity.cjs ledgerStats on
 * Codex). The range keeps dailyActivity / dailyModelTokens entries on or after
 * Pw's cutoff; sessions, messages and tool calls are summed over it and every
 * kept dailyActivity entry is an active day. Per-model tokens are ranged, while
 * a model's usage is the all-time stats.modelUsage[model]; models under 0.05%
 * of the ranged total are dropped. Peak hour (stats.peakActivityHour) and the
 * heatmap (stats.dailyActivity) are not ranged: Xw and eT read the raw stats.
 */
export function aggregateStats(stats, range = "all", todayKey = localDayKey(new Date())) {
  const cutoff = rangeCutoff(range, todayKey);
  const inRange = (date) => !cutoff || date >= cutoff;
  const activity = Array.isArray(stats?.dailyActivity) ? stats.dailyActivity.filter((day) => inRange(day?.date)) : [];
  let totalSessions = 0, totalMessages = 0, totalToolCalls = 0;
  for (const day of activity) {
    totalSessions += number(day.sessionCount);
    totalMessages += number(day.messageCount);
    totalToolCalls += number(day.toolCallCount);
  }
  const chartDays = Array.isArray(stats?.dailyModelTokens) ? stats.dailyModelTokens.filter((day) => inRange(day?.date)) : [];
  const tokens = new Map();
  for (const day of chartDays)
    for (const [model, count] of Object.entries(day.tokensByModel || {})) tokens.set(model, (tokens.get(model) ?? 0) + number(count));
  const usage = stats?.modelUsage && typeof stats.modelUsage === "object" ? stats.modelUsage : {};
  const all = Array.from(tokens.entries())
    .map(([model, count]) => ({ model, tokens: count, usage: (Object.hasOwn(usage, model) && usage[model]) || ZERO_USAGE }))
    .sort((a, b) => b.tokens - a.tokens);
  const totalTokens = all.reduce((sum, entry) => sum + entry.tokens, 0);
  const modelTotals = all.filter((entry) => entry.tokens >= totalTokens * 5e-4);
  return {
    totalSessions, totalMessages, totalToolCalls, totalTokens,
    activeDays: activity.length,
    modelTotals, chartDays, modelKeys: modelTotals.map((entry) => entry.model),
  };
}

/** eT: the heatmap's per-day message counts, all-time (a later entry for a date wins, like its Map). */
export function activityCounts(dailyActivity) {
  const counts = {};
  for (const day of Array.isArray(dailyActivity) ? dailyActivity : []) if (typeof day?.date === "string") counts[day.date] = number(day.messageCount);
  return counts;
}

/** shared-14 oT/sT: ≥1e9 B, ≥1e6 M, ≥1e3 k, one decimal, ".0" stripped, rollover at 1000. */
export function compactTokens(value) {
  const n = number(value);
  const strip = (text) => (text.endsWith(".0") ? text.slice(0, -2) : text);
  if (n >= 1e9) return `${strip((n / 1e9).toFixed(1))}B`;
  if (n >= 1e6) {
    const m = Number((n / 1e6).toFixed(1));
    return m >= 1e3 ? `${strip((n / 1e9).toFixed(1))}B` : `${strip(m.toFixed(1))}M`;
  }
  if (n >= 1e3) {
    const k = Number((n / 1e3).toFixed(1));
    return k >= 1e3 ? `${strip((n / 1e6).toFixed(1))}M` : `${strip(k.toFixed(1))}k`;
  }
  return String(n);
}

const MAX_TICKS = 6, PREFERRED_TICKS = 4;

/** oT: nice steps 1/2/5/10/20/50 × 10^n, at most six ticks, closest to four on ties. */
export function niceTicks(max) {
  const value = number(max);
  if (value <= 0) return [];
  const magnitude = 10 ** Math.floor(Math.log10(value / MAX_TICKS));
  const candidates = [1, 2, 5, 10, 20, 50]
    .map((factor) => {
      const step = Math.max(1, factor * magnitude);
      return { step, steps: Math.ceil(value / step) };
    })
    .filter((candidate) => candidate.steps <= MAX_TICKS);
  const best = candidates.reduce((chosen, candidate) => {
    const span = candidate.step * candidate.steps, chosenSpan = chosen.step * chosen.steps;
    return span < chosenSpan || (span === chosenSpan && Math.abs(candidate.steps - PREFERRED_TICKS) < Math.abs(chosen.steps - PREFERRED_TICKS))
      ? candidate : chosen;
  });
  return Array.from({ length: best.steps + 1 }, (_, index) => index * best.step);
}

/** sT: per-day stacked segments in model-key order plus the tick scale. */
export function buildChart(chartDays, modelKeys) {
  let max = 0;
  const days = chartDays.map((day) => {
    let total = 0;
    const segments = [];
    modelKeys.forEach((model, index) => {
      const count = number(day.tokensByModel?.[model]);
      if (count > 0) { segments.push({ model, tokens: count, color: modelColor(index) }); total += count; }
    });
    max = Math.max(max, total);
    return { date: day.date, segments, total };
  });
  return { days, ticks: niceTicks(max) };
}

export const HEATMAP_HUE = 217;

/** jw: hsl(217 70% min(88, 58 + 7i)%). */
export function modelColor(index) {
  return `hsl(${HEATMAP_HUE} 70% ${Math.min(88, 58 + index * 7)}%)`;
}

/** eT: lightness 80 - ceil(ratio*4)*8 for non-zero counts; null when zero. */
export function heatmapLightness(count, max) {
  if (!max || !count) return null;
  return 80 - Math.ceil((count / max) * 4) * 8;
}

/** eT: 182 days ending on the Saturday of the current week, 26 columns of 7. */
export function heatmapWeeks(todayKey, activity = {}) {
  const today = parseDayKey(todayKey);
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(end.getDate() - 182 + 1);
  const cells = [];
  let max = 0;
  for (let index = 0; index < 182; index++) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDayKey(date);
    const count = number(activity[key]);
    max = Math.max(max, count);
    cells.push({ date: key, count, future: key > todayKey });
  }
  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return { weeks, max };
}

export const BOOKS = Object.freeze([
  { name: "The Little Prince", tokens: 22000 },
  { name: "Animal Farm", tokens: 39000 },
  { name: "The Great Gatsby", tokens: 62000 },
  { name: "Harry Potter and the Philosopher's Stone", tokens: 103000 },
  { name: "The Hobbit", tokens: 123000 },
  { name: "Pride and Prejudice", tokens: 156000 },
  { name: "Dune", tokens: 244000 },
  { name: "Moby-Dick", tokens: 268000 },
  { name: "The Lord of the Rings", tokens: 576000 },
  { name: "War and Peace", tokens: 730000 },
]);

/** Qw: one seeded pick among books the total reaches; null below 22k. */
export function bookSentence(totalTokens, seed) {
  const total = number(totalTokens);
  const eligible = BOOKS.filter((book) => total >= book.tokens);
  if (!eligible.length) return null;
  const pick = eligible[Math.min(eligible.length - 1, Math.max(0, Math.floor(number(seed) * eligible.length)))];
  const times = Math.floor(total / pick.tokens);
  return times >= 2
    ? t("You’ve used ~{times}× more tokens than {book}.", { times, book: t(pick.name) })
    : t("You’ve used about as many tokens as {book}.", { book: t(pick.name) });
}

/** Fw: a YYYY-MM-DD key formatted as "Sep 30" in UTC so the key's day is kept. */
export function formatDayKey(key, locale) {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${key}T00:00:00Z`));
}

/** lT: every Nth x label where N = ceil(days / floor(plot / (probe + 8))), at least every 2nd slot. */
export function chartLabelStep(dayCount, plotWidth, probeWidth) {
  const perRow = Math.max(2, Math.floor(number(plotWidth) / (number(probeWidth) + 8)));
  return Math.max(1, Math.ceil(number(dayCount) / perRow));
}

const RELATIVE_UNITS = [
  ["year", 31536e3], ["month", 2592e3], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60],
];
const narrowStyles = new Map();
const signed = /^[+−\p{Pd}]/u;

/** uO/lO: narrow relative time; locales whose narrow form is sign-prefixed fall back to short. */
export function narrowRelativeTime(dateMs, nowMs, locale = "en") {
  let style = narrowStyles.get(locale);
  if (style === undefined) {
    const probe = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "narrow" });
    style = RELATIVE_UNITS.some(([unit]) => signed.test(probe.format(-5, unit).trim())) ? "short" : "narrow";
    narrowStyles.set(locale, style);
  }
  const seconds = Math.round((number(dateMs) - number(nowMs)) / 1e3);
  const magnitude = Math.abs(seconds);
  if (magnitude < 60) return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style }).format(0, "second");
  let unit = "minute", size = 60;
  for (const [name, span] of RELATIVE_UNITS) if (magnitude >= span) { unit = name; size = span; break; }
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style }).format(Math.round(seconds / size), unit);
}

export const PLACEHOLDER_WIDTHS = Object.freeze(["40%", "33.3333%", "50%", "60%"]);

export function sessionTimestampMs(session) {
  const value = session?.updatedAt ?? session?.createdAt;
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  if (typeof value === "string") { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : 0; }
  return 0;
}

// B08 Action Center › Pull requests (cc43287c9 QR b :4980-4987, hR :4280-4352, cz :5451-5520, iz :5087-5131).
// Local sessions name their PR through the core's binding (codeDesktop.pr) or the band's GitHub CLI lookup (prInfo);
// lR "active" states minus drafts list, newest session first, one row per PR URL.
const ACTIVE_PR_STATES = new Set(["changesRequested", "conflicting", "open", "approved", "queued", "draft"]);

/** owner/name of a github.com pull request URL (the row's repo meta, vR d = repoSlug). */
export function pullRequestRepoSlug(url) {
  const match = /^https:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/pull\/\d+/i.exec(String(url ?? ""));
  return match ? `${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}` : undefined;
}

/** The session's PR record ({number, url, state, title, checks}), or null. */
export function sessionPullRequest(session) {
  const info = session?.prInfo && typeof session.prInfo === "object" ? session.prInfo : null;
  const bound = session?.codeDesktop?.pr && typeof session.codeDesktop.pr === "object" ? session.codeDesktop.pr : null;
  const url = [info?.url, session?.prLink, bound?.url].find((value) => typeof value === "string" && /^https:\/\//i.test(value));
  if (!url) return null;
  const number = Number(info?.number ?? bound?.number ?? /\/pull\/(\d+)(?:[/?#]|$)/.exec(url)?.[1]);
  if (!Number.isInteger(number) || number <= 0) return null;
  const state = typeof info?.state === "string" ? info.state : typeof session.prState === "string" ? session.prState : "open";
  const title = typeof info?.title === "string" && info.title ? info.title : typeof bound?.title === "string" && bound.title ? bound.title : null;
  return { number, url, state, title, checks: info?.checks ?? null };
}

/** QR b: active non-draft PRs of unarchived sessions, newest session first, deduped by URL (tc keeps the first). */
export function activePullRequestEntries(sessions, { archived = () => false } = {}) {
  const entries = [];
  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (!session || archived(session)) continue;
    const pr = sessionPullRequest(session);
    if (!pr || !ACTIVE_PR_STATES.has(pr.state) || pr.state === "draft") continue;
    entries.push({ session, pr, repoSlug: pullRequestRepoSlug(pr.url) ?? "", timestamp: sessionTimestampMs(session) });
  }
  entries.sort((a, b) => number(b.timestamp) - number(a.timestamp));
  const seen = new Set();
  return entries.filter((entry) => {
    const key = entry.pr.url ?? `${entry.repoSlug.toLowerCase()}#${entry.pr.number}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** hR (:4280-4352): the row's category and pill ({tone, label}) from the PR state and its check counts (mR). */
export function classifyPullRequest(entry, stateLabel = (state) => state) {
  const { state } = entry.pr;
  const checks = entry.pr.checks && entry.pr.checks.total > 0 ? entry.pr.checks : null;
  const failing = (checks?.failed ?? 0) > 0, pending = (checks?.pending ?? 0) > 0;
  const allPassed = checks !== null && checks.failed === 0 && checks.pending === 0;
  let category = "inReview", pill;
  if (state === "merged") pill = { tone: "neutral", label: stateLabel("merged") };
  else if (state === "closed") pill = { tone: "neutral", label: stateLabel("closed") };
  else if (state === "draft") { category = "draft"; pill = { tone: "neutral", label: stateLabel("draft") }; }
  else if (state === "conflicting") { category = "needsAttention"; pill = { tone: "orange", label: stateLabel("conflicting") }; }
  else if (state === "changesRequested") { category = "needsAttention"; pill = { tone: "closed", label: stateLabel("changesRequested") }; }
  else if (failing) { category = "needsAttention"; pill = { tone: "red", label: t("CI failing") }; }
  else if (state === "queued") { category = "readyToMerge"; pill = { tone: "yellow", label: stateLabel("queued") }; }
  else if (state === "approved" && (allPassed || checks === null)) { category = "readyToMerge"; pill = { tone: "green", label: t("Ready to merge") }; }
  else if (state === "approved") pill = { tone: "green", label: stateLabel("approved") };
  else if (pending) pill = { tone: "neutral", label: t("CI {done}/{total}", { done: (checks?.passed ?? 0) + (checks?.failed ?? 0), total: checks?.total ?? 0 }) };
  else pill = { tone: "neutral", label: t("Ready for review") };
  return { entry, category, pill };
}

/** cz l (:5462-5467): readyToMerge and needsAttention rows first, each group in its incoming order. */
export function sortPullRequestRows(rows) {
  const urgent = (row) => row.category === "readyToMerge" || row.category === "needsAttention";
  return [...rows.filter(urgent), ...rows.filter((row) => !urgent(row))];
}
