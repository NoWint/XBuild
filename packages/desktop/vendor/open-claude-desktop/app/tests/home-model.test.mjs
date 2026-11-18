import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  acknowledgementTime, activityCounts, aggregateStats, bookSentence, buildChart, chartLabelStep, classifyAttention, compactTokens, formatDayKey,
  greetingName, greetingText, heatmapLightness, heatmapWeeks, landingClear, modelColor, narrowRelativeTime, niceTicks,
  rangeCutoff, rowLimit, sessionsLimit, sessionTimestampMs, sortAttention, unackedError,
} from "../src/home-model.mjs";

test("greeting name: trimmed preferred name, e-mail local part, nothing invented", () => {
  assert.equal(greetingName("  Fixture "), "Fixture");
  assert.equal(greetingName("a.b@example.com"), "a.b");
  assert.equal(greetingName(""), undefined);
  assert.equal(greetingName("   "), undefined);
  assert.equal(greetingName(undefined), undefined);
  assert.equal(greetingText("Fixture", true), "What’s up next, Fixture?");
  assert.equal(greetingText(undefined, true), "What’s up next?");
  assert.equal(greetingText("Fixture", false), "Welcome back, Fixture");
  assert.equal(greetingText(undefined, false), "Welcome back");
});

test("attention classification follows Pk: pinned/archived/acked/responding excluded", () => {
  const base = { archived: false, pinned: false, hasApproval: false, running: false, unread: false, ackedAt: undefined, timestamp: 1000 };
  assert.equal(classifyAttention({ ...base, hasApproval: true }), "blocked");
  assert.equal(classifyAttention({ ...base, hasApproval: true, running: true }), "blocked", "an approval arrives mid-turn");
  assert.equal(classifyAttention({ ...base, unread: true }), "unread");
  assert.equal(classifyAttention({ ...base, unread: true, running: true }), null, "a running unread session is responding");
  assert.equal(classifyAttention({ ...base, unread: true, pinned: true }), null);
  assert.equal(classifyAttention({ ...base, hasApproval: true, archived: true }), null);
  assert.equal(classifyAttention({ ...base, unread: true, ackedAt: 1000 }), null, "acked at the same timestamp");
  assert.equal(classifyAttention({ ...base, hasApproval: true, ackedAt: 999 }), "blocked", "a newer timestamp re-lists");
  assert.equal(classifyAttention(base), null);
});

test("B29 zR: a failed session is Needs input until acknowledged after the failure", () => {
  const base = { archived: false, pinned: false, hasApproval: false, running: false, unread: false, ackedAt: undefined, timestamp: 1000 };
  assert.equal(classifyAttention({ ...base, errorAt: 1200 }), "blocked");
  assert.equal(classifyAttention({ ...base, errorAt: 1200, unread: true }), "blocked", "the error outranks unread");
  assert.equal(classifyAttention({ ...base, errorAt: 1200, ackedAt: 1100 }), "blocked", "acked before the failure");
  assert.equal(classifyAttention({ ...base, errorAt: 1200, ackedAt: 1200 }), null, "Pk: ackedAt >= errorAt");
  assert.equal(classifyAttention({ ...base, errorAt: 900, ackedAt: 1000 }), null, "acked at the session timestamp covers an older failure");
  assert.equal(classifyAttention({ ...base, errorAt: 1200, running: true }), null, "a new turn is responding");
  assert.equal(classifyAttention({ ...base, errorAt: 1200, pinned: true }), null);
  assert.equal(classifyAttention({ ...base, errorAt: 1200, archived: true }), null);
  assert.equal(classifyAttention({ ...base, errorAt: Number.NaN }), null);
  assert.equal(acknowledgementTime(1000, 1200), 1200, "O6: max(timestamp, errorAt)");
  assert.equal(acknowledgementTime(1000, undefined), 1000);
  assert.equal(unackedError({ errorAt: 1200, timestamp: 1000 }), true);
  assert.equal(unackedError({ errorAt: 1200, ackedAt: 1200, timestamp: 1300 }), false);
  assert.equal(unackedError({ errorAt: 1200, ackedAt: 1300, timestamp: 1300 }), false);
  assert.equal(unackedError({ errorAt: 1200, ackedAt: 1100, timestamp: 1000 }), true, "the failure is newer than the acknowledgement");
  assert.equal(unackedError({ errorAt: 900, ackedAt: 1000, timestamp: 1000 }), false, "acked at the session timestamp");
  assert.equal(unackedError({ errorAt: 1200, ackedAt: 900, timestamp: 1000 }), true);
  assert.equal(unackedError({ errorAt: 1200, archived: true }), false);
  assert.equal(unackedError({}), false);
});

test("B29 session-attention.cjs: failures mark errorAt; a new turn clears it", () => {
  const require = createRequire(import.meta.url);
  const { sessionErrorPatch } = require("../electron/session-attention.cjs");
  const failed = { method: "turn/completed", params: { threadId: "t", turn: { id: "1", status: "failed", error: { message: "boom" } } } };
  assert.deepEqual(sessionErrorPatch({ pinned: true }, failed, 5), { pinned: true, errorAt: 5 });
  assert.equal(sessionErrorPatch({}, { method: "turn/completed", params: { turn: { id: "1", status: "completed" } } }, 5), null);
  assert.equal(sessionErrorPatch({}, { method: "turn/completed", params: { turn: { id: "1", status: "interrupted", error: { message: "x" } } } }, 5), null);
  assert.deepEqual(sessionErrorPatch(undefined, { method: "error", params: { threadId: "t", error: { message: "x" }, willRetry: false } }, 7), { errorAt: 7 });
  assert.equal(sessionErrorPatch({}, { method: "error", params: { threadId: "t", error: { message: "x" }, willRetry: true } }, 7), null, "a retry is not a failure");
  assert.deepEqual(sessionErrorPatch({ errorAt: 5, ackedAt: 3 }, { method: "turn/started", params: { turn: { id: "2" } } }), { ackedAt: 3 });
  assert.equal(sessionErrorPatch({ ackedAt: 3 }, { method: "turn/started", params: {} }), null);
});

test("blocked rows precede unread rows regardless of timestamps; each group newest first", () => {
  const rows = [
    { kind: "unread", timestamp: 500, session: { id: "u-old" } },
    { kind: "blocked", timestamp: 10, session: { id: "b-old" } },
    { kind: "unread", timestamp: 900, session: { id: "u-new" } },
    { kind: "blocked", timestamp: 20, session: { id: "b-new" } },
  ];
  assert.deepEqual(sortAttention(rows).map((row) => row.session.id), ["b-new", "b-old", "u-new", "u-old"]);
});

test("row limits: 3 + one per min-height breakpoint, Sessions capped at 5", () => {
  assert.equal(rowLimit(768), 3);
  assert.equal(rowLimit(800), 4);
  assert.equal(rowLimit(950), 5);
  assert.equal(rowLimit(1000), 6);
  assert.equal(rowLimit(1100), 7);
  assert.equal(sessionsLimit(768), 3);
  assert.equal(sessionsLimit(1100), 5);
  assert.equal(landingClear({ sessions: 0, projects: 0, prs: 0 }), true);
  assert.equal(landingClear({ sessions: 2, projects: 0, prs: 0 }), false);
  assert.equal(landingClear(null), true);
});

test("range cutoffs use date keys and keep days-1 earlier days", () => {
  assert.equal(rangeCutoff("all", "2026-09-20"), null);
  assert.equal(rangeCutoff("7d", "2026-09-20"), "2026-09-14");
  assert.equal(rangeCutoff("30d", "2026-09-20"), "2026-08-22");
  assert.equal(rangeCutoff("7d", "2026-03-03"), "2026-02-25");
});

// The Codex fallback: this ledger through activity.cjs ledgerStats, then Iw.
const { ledgerStats } = createRequire(import.meta.url)("../electron/activity.cjs");
const ledger = {
  days: {
    "2026-09-20": { messages: 1000, tokens: 7300, sessions: 2, hours: { 5: 900, 9: 100 }, models: { a: 4000, b: 2000, c: 1000, d: 300 },
      modelUsage: { a: { input: 3000, output: 1000, cached: 0 }, b: { input: 1500, output: 500, cached: 0 } } },
    "2026-09-14": { messages: 250, tokens: 5000, sessions: 1, hours: { 9: 250 }, models: { a: 5000 }, modelUsage: { a: { input: 4000, output: 1000, cached: 0 } } },
    "2026-09-13": { messages: 30, tokens: 22000, hours: { 9: 30 }, models: { e: 22000 } },
    // today-30: outside "30d" (the cutoff is today minus 29, inclusive). Its
    // modelUsage still counts: Iw attaches stats.modelUsage[model] unranged.
    "2026-08-21": { messages: 4, tokens: 1000000, hours: { 9: 4 }, models: { tiny: 400, f: 999600 },
      modelUsage: { a: { input: 100, output: 50, cached: 25 }, f: { input: 900000, output: 99600, cached: 0 } } },
  },
};
const usageOf = (inputTokens, outputTokens, cacheReadInputTokens = 0) => ({ inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens: 0 });

test("aggregateStats over the ledger fallback: per-day sessions/messages/active days by range; model list drops < 0.05%", () => {
  const stats = ledgerStats(ledger);
  const week = aggregateStats(stats, "7d", "2026-09-20");
  assert.equal(week.totalSessions, 3);
  assert.equal(week.totalMessages, 1250);
  assert.equal(week.totalTokens, 12300);
  assert.equal(week.activeDays, 2);
  assert.deepEqual(week.modelKeys, ["a", "b", "c", "d"]);
  assert.deepEqual(week.modelTotals[0], { model: "a", tokens: 9000, usage: usageOf(7075, 2050, 25) },
    "tokens are ranged but in/out usage is all-time (official Iw reads stats.modelUsage[model] unranged); legacy input excludes cached");
  assert.deepEqual(week.modelTotals[2], { model: "c", tokens: 1000, usage: usageOf(0, 0) }, "no usage record → zero usage");
  assert.deepEqual(week.chartDays.map((day) => day.date), ["2026-09-14", "2026-09-20"]);
  assert.equal(stats.peakActivityHour, 5, "peak hour is all-time");
  assert.equal(activityCounts(stats.dailyActivity)["2026-08-21"], 4, "heatmap counts are all-time");
  const month = aggregateStats(stats, "30d", "2026-09-20");
  assert.equal(month.activeDays, 3);
  assert.equal(month.totalMessages, 1280);
  const boundary = aggregateStats(ledgerStats({ days: { "2026-08-22": { messages: 1, tokens: 1 }, "2026-08-21": { messages: 1, tokens: 1 } } }), "30d", "2026-09-20");
  assert.equal(boundary.activeDays, 1, "today-29 is the first day of 30d; today-30 is outside");
  const all = aggregateStats(stats, "all", "2026-09-20");
  assert.equal(all.activeDays, 4);
  assert.equal(all.totalTokens, 1034425, "the legacy 08-21 day also charges a from its usage record: (100 − 25) + 50");
  assert.ok(!all.modelKeys.includes("tiny"), "400 of 1,034,425 is under 0.05%");
  assert.ok(!all.modelKeys.includes("d"), "300 of 1,034,425 is under 0.05% in All, although kept in 7d");
  assert.deepEqual(all.modelTotals.find((entry) => entry.model === "f").usage, usageOf(900000, 99600));
  assert.deepEqual(all.modelTotals.find((entry) => entry.model === "a").usage, week.modelTotals[0].usage, "usage does not change with the range");
  assert.equal(ledgerStats({ days: {} }).peakActivityHour, null);
  assert.equal(aggregateStats(ledgerStats("corrupt"), "all", "2026-09-20").activeDays, 0);
});

// Iw (code-home.js:13711-13751) on the core's stats object, entry for entry.
test("aggregateStats is Iw: ranged entries, tool calls, 0.05% cutoff on the ranged total, all-time modelUsage", () => {
  const stats = {
    dailyActivity: [
      { date: "2026-08-20", messageCount: 9, sessionCount: 1, toolCallCount: 4 },
      { date: "2026-09-14", messageCount: 0, sessionCount: 0, toolCallCount: 2 },
      { date: "2026-09-20", messageCount: 12, sessionCount: 2, toolCallCount: 7 },
    ],
    dailyModelTokens: [
      { date: "2026-08-20", tokensByModel: { old: 5_000_000 } },
      { date: "2026-09-14", tokensByModel: { flash: 1_000_000, tiny: 499 } },
      { date: "2026-09-20", tokensByModel: { flash: 600_000, pro: 400_000, edge: 1500 } },
    ],
    modelUsage: { flash: usageOf(1, 2, 3), pro: usageOf(4, 5), old: usageOf(6, 7) },
    peakActivityHour: 14,
  };
  const week = aggregateStats(stats, "7d", "2026-09-20");
  assert.deepEqual({ ...week, modelTotals: undefined }, {
    totalSessions: 2, totalMessages: 12, totalToolCalls: 9, totalTokens: 2_001_999, activeDays: 2, modelTotals: undefined,
    chartDays: stats.dailyModelTokens.slice(1), modelKeys: ["flash", "pro", "edge"],
  }, "a tool-call-only day is active; 499 of 2,001,999 is under 0.05% while 1,500 is not");
  assert.deepEqual(week.modelTotals.map((entry) => [entry.model, entry.tokens]), [["flash", 1_600_000], ["pro", 400_000], ["edge", 1500]]);
  assert.equal(week.modelTotals[0].usage, stats.modelUsage.flash, "the raw all-time usage record");
  assert.deepEqual(week.modelTotals[2].usage, usageOf(0, 0), "a model without modelUsage reads zeros");
  const all = aggregateStats(stats, "all", "2026-09-20");
  assert.equal(all.activeDays, 3);
  assert.deepEqual(all.modelKeys, ["old", "flash", "pro"], "edge (1,500 of 7,001,999) drops in All");
  assert.equal(all.totalSessions, 3);
  // Prototype names are never usage records; malformed stats aggregate to nothing.
  assert.deepEqual(aggregateStats({ ...stats, modelUsage: {}, dailyModelTokens: [{ date: "2026-09-20", tokensByModel: { constructor: 5 } }] }, "all", "2026-09-20").modelTotals[0].usage, usageOf(0, 0));
  assert.deepEqual(aggregateStats(null, "all", "2026-09-20"), { totalSessions: 0, totalMessages: 0, totalToolCalls: 0, totalTokens: 0, activeDays: 0, modelTotals: [], chartDays: [], modelKeys: [] });
  assert.deepEqual(activityCounts(stats.dailyActivity), { "2026-08-20": 9, "2026-09-14": 0, "2026-09-20": 12 });
});

test("compact token formatter: k/M/B, '.0' stripped, rollover at 1000", () => {
  assert.equal(compactTokens(0), "0");
  assert.equal(compactTokens(999), "999");
  assert.equal(compactTokens(1000), "1k");
  assert.equal(compactTokens(22000), "22k");
  assert.equal(compactTokens(1234), "1.2k");
  assert.equal(compactTokens(999950), "1M");
  assert.equal(compactTokens(999949), "999.9k");
  assert.equal(compactTokens(999950000), "1B");
  assert.equal(compactTokens(10500000000), "10.5B");
  assert.equal(compactTokens(2000), "2k");
});

test("nice ticks: steps 1/2/5 × 10^n, at most six ticks, prefer four", () => {
  assert.deepEqual(niceTicks(7300), [0, 2000, 4000, 6000, 8000]);
  assert.deepEqual(niceTicks(0), []);
  assert.deepEqual(niceTicks(3), [0, 1, 2, 3]);
  assert.deepEqual(niceTicks(10), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(niceTicks(100).at(-1), 100);
  assert.ok(niceTicks(123456).length <= 7);
  const chart = buildChart([{ date: "2026-09-20", tokensByModel: { a: 4000, b: 300 } }], ["a", "b"]);
  assert.deepEqual(chart.days[0].segments.map((segment) => segment.model), ["a", "b"]);
  assert.equal(chart.days[0].segments[1].color, modelColor(1));
  assert.deepEqual(chart.ticks, [0, 1000, 2000, 3000, 4000, 5000]);
});

test("heatmap: 182 cells in 26 columns ending on Saturday; lightness 80 - ceil(4r)*8", () => {
  const { weeks, max } = heatmapWeeks("2026-09-20", { "2026-09-20": 1000, "2026-09-14": 250, "2026-01-01": 5 });
  assert.equal(weeks.length, 26);
  assert.ok(weeks.every((week) => week.length === 7));
  assert.equal(weeks.at(-1).at(-1).date, "2026-09-26", "Saturday of the current week");
  assert.equal(weeks.at(-1).at(-1).future, true);
  assert.equal(weeks.at(-1)[0].date, "2026-09-20");
  assert.equal(weeks.at(-1)[0].future, false);
  assert.equal(weeks[0][0].date, "2026-03-29");
  assert.equal(max, 1000, "counts outside the window are ignored");
  assert.equal(heatmapLightness(1000, 1000), 48);
  assert.equal(heatmapLightness(250, 1000), 72);
  assert.equal(heatmapLightness(200, 1000), 72);
  assert.equal(heatmapLightness(0, 1000), null);
  assert.equal(modelColor(0), "hsl(217 70% 58%)");
  assert.equal(modelColor(1), "hsl(217 70% 65%)");
  assert.equal(modelColor(9), "hsl(217 70% 88%)");
});

test("book footnote: ten thresholds, seeded pick, floor ratio >= 2 wording, hidden below 22k", () => {
  assert.equal(bookSentence(21999, 0), null);
  assert.equal(bookSentence(22000, 0), "You’ve used about as many tokens as The Little Prince.");
  assert.equal(bookSentence(44000, 0), "You’ve used ~2× more tokens than The Little Prince.");
  assert.equal(bookSentence(44000, 0.99), "You’ve used about as many tokens as Animal Farm.");
  assert.equal(bookSentence(10500000000, 0.999), "You’ve used ~14383× more tokens than War and Peace.");
});

test("narrow relative time and day-key formatting", () => {
  const now = Date.UTC(2026, 8, 20, 12);
  assert.equal(narrowRelativeTime(now - 30e3, now, "en"), "now");
  assert.equal(narrowRelativeTime(now - 5 * 60e3, now, "en"), "5m ago");
  assert.equal(narrowRelativeTime(now - 3 * 3600e3, now, "en"), "3h ago");
  assert.equal(narrowRelativeTime(now - 86400e3, now, "en"), "yesterday");
  assert.equal(formatDayKey("2000-09-30", "en"), "Sep 30");
  assert.equal(formatDayKey("2026-09-20", "en"), "Sep 20");
  assert.equal(chartLabelStep(30, 300, 40), 5, "300px fits six labels of 48px");
  assert.equal(chartLabelStep(4, 0, 40), 2, "at least two slots per row");
  assert.equal(sessionTimestampMs({ updatedAt: 1758326400 }), 1758326400000);
  assert.equal(sessionTimestampMs({ createdAt: 1758326400000 }), 1758326400000);
  assert.equal(sessionTimestampMs({}), 0);
});

test("B08 Action Center › Pull requests: active non-draft PRs, newest first, one row per URL; hR pills; cz urgent first", async () => {
  const { activePullRequestEntries, classifyPullRequest, sortPullRequestRows, pullRequestRepoSlug, sessionPullRequest } = await import("../src/home-model.mjs");
  const { prStateLabel } = await import("../src/git-rail-model.mjs");
  const url = (n) => `https://github.com/acme/widget/pull/${n}`;
  const sessions = [
    { id: "a", updatedAt: 100, prInfo: { number: 1, url: url(1), state: "open", title: "First", checks: null } },
    { id: "b", updatedAt: 300, prInfo: { number: 2, url: url(2), state: "approved", title: null, checks: { passed: 2, failed: 0, pending: 0, skipped: 0, total: 2 } } },
    { id: "c", updatedAt: 200, prInfo: { number: 3, url: url(3), state: "draft" } },
    { id: "d", updatedAt: 250, prInfo: { number: 4, url: url(4), state: "merged" } },
    { id: "e", updatedAt: 400, codeDesktop: { pr: { url: url(1) } }, prState: "open", prLink: url(1) },
    { id: "f", updatedAt: 500, archived: true, prInfo: { number: 5, url: url(5), state: "open" } },
    { id: "g", updatedAt: 150, prInfo: { number: 6, url: url(6), state: "open", checks: { passed: 1, failed: 1, pending: 0, skipped: 0, total: 2 } } },
  ];
  const entries = activePullRequestEntries(sessions, { archived: (session) => session.archived === true });
  assert.deepEqual(entries.map((entry) => entry.session.id), ["e", "b", "g"], "draft/merged/archived dropped; #1 kept once for the newest session");
  assert.equal(entries[0].repoSlug, "acme/widget");
  assert.deepEqual(sessionPullRequest(sessions[4]), { number: 1, url: url(1), state: "open", title: null, checks: null });
  const rows = entries.map((entry) => classifyPullRequest(entry, prStateLabel));
  assert.deepEqual(rows.map((row) => [row.category, row.pill.tone, row.pill.label]), [
    ["inReview", "neutral", "Ready for review"],
    ["readyToMerge", "green", "Ready to merge"],
    ["needsAttention", "red", "CI failing"],
  ]);
  assert.deepEqual(sortPullRequestRows(rows).map((row) => row.entry.session.id), ["b", "g", "e"]);
  const pending = classifyPullRequest({ pr: { state: "open", checks: { passed: 1, failed: 0, pending: 2, skipped: 0, total: 3 } } }, prStateLabel);
  assert.deepEqual(pending.pill, { tone: "neutral", label: "CI 1/3" });
  assert.deepEqual(classifyPullRequest({ pr: { state: "conflicting" } }, prStateLabel).pill, { tone: "orange", label: "Merge conflicts" });
  assert.deepEqual(classifyPullRequest({ pr: { state: "changesRequested" } }, prStateLabel).pill, { tone: "closed", label: "Changes requested" });
  assert.deepEqual(classifyPullRequest({ pr: { state: "approved", checks: { passed: 0, failed: 0, pending: 1, skipped: 0, total: 1 } } }, prStateLabel),
    { entry: { pr: { state: "approved", checks: { passed: 0, failed: 0, pending: 1, skipped: 0, total: 1 } } }, category: "inReview", pill: { tone: "green", label: "Approved" } });
  assert.equal(pullRequestRepoSlug("https://gitlab.com/a/b/-/merge_requests/1"), undefined);
  assert.equal(landingClear({ sessions: 0, projects: 0, prs: 1 }), false, "$R: a PR alone keeps the Action Center");
});
