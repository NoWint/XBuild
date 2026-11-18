import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { SourceTooltip, SourceTooltipGroup } from "./source-tooltip.jsx";
import {
  activityCounts, aggregateStats, bookSentence, buildChart, chartLabelStep, compactTokens, formatDayKey,
  greetingName, greetingText, heatmapLightness, heatmapWeeks, localDayKey, modelColor,
} from "./home-model.mjs";
import "./source-home.css";
import { getLocale, t } from "../electron/i18n/index.mjs";
import { usePersona } from "./use-persona.js";
import { greetingFor } from "./persona-store.mjs";
import { PersonaSparkGlyph } from "./source-spark.jsx";

// 2.2553.1 draft home (cc43287c9 Jk greeting; code-home Rw/qw/Jw/Yw stats card).
// The card renders the original getCodeStats object (main.cjs 'stats': the
// DeepSeek core's codeDesktop/stats/read, or this client's ledger on Codex).

const TAB_SEGMENTS = [{ value: "overview", label: t("Overview") }, { value: "models", label: t("Models") }];
const RANGE_SEGMENTS = [{ value: "all", label: t("All") }, { value: "30d", label: t("30d") }, { value: "7d", label: t("7d") }];
const MODEL_ROWS = 6;
const LABEL_PROBE_KEY = "2000-09-30";
// Numbers, days and hours follow the UI language (Settings › Language), not the system locale.
const formatNumber = (value) => new Intl.NumberFormat(getLocale()).format(value);
const dayLabel = (key) => formatDayKey(key, getLocale());

/** Jk: spark (22px, pulse once on mount) + title; copy follows landingClear. */
export function SourceGreeting({ displayName, landingClear = true, shimmerOnMount = true }) {
  const [pulse] = useState(!!shimmerOnMount);
  const persona = usePersona(); // C2: greeting template and assistant icon
  return (
    <header className="welcome-heading source-greeting">
      {persona.sparkIcon === "spark"
        ? <img className={"claude-spark" + (pulse ? " source-spark-pulse" : "")} src="./assets/v1/claude-spark.svg"
          alt="" width="22" height="22" />
        : <PersonaSparkGlyph persona={persona} size={22} className={"claude-spark" + (pulse ? " source-spark-pulse" : "")} />}
      <h1>{greetingFor({ displayName, landingClear }, persona)}</h1>
    </header>
  );
}

/**
 * Kw: before the card is hovered or focused the tabs are an aria-hidden group
 * of disabled buttons (deferred mount); afterwards a live tablist.
 */
function StatsTabs({ segments, value, label, live, onChange }) {
  const listRef = useRef(null);
  if (!live) {
    return (
      <div aria-hidden="true" data-size="sm" className="sh-tabs">
        {segments.map((segment) => (
          <button key={segment.value} type="button" disabled className={"sh-tab" + (segment.value === value ? " is-selected" : "")}>
            <span className="sh-tab-label">{segment.label}</span>
          </button>
        ))}
      </div>
    );
  }
  const move = (event) => {
    const keys = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const index = segments.findIndex((segment) => segment.value === value);
    const delta = keys[event.key];
    const next = delta === -Infinity ? 0 : delta === Infinity ? segments.length - 1 : (index + delta + segments.length) % segments.length;
    onChange(segments[next].value);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return (
    <div ref={listRef} role="tablist" aria-label={label} data-size="sm" className="sh-tabs" onKeyDown={move}>
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <button key={segment.value} type="button" role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1}
            className={"sh-tab" + (selected ? " is-selected" : "")} onClick={() => onChange(segment.value)}>
            <span className="sh-tab-label">{segment.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TabsRow({ tab, range, live, onTab, onRange, dimmed }) {
  return (
    <div className={"sh-tabs-row" + (dimmed ? " is-hold" : "")}>
      <StatsTabs segments={TAB_SEGMENTS} value={tab} label={t("Stats view")} live={live} onChange={onTab} />
      <span className="sh-spacer" />
      <StatsTabs segments={RANGE_SEGMENTS} value={range} label={t("Date range")} live={live} onChange={onRange} />
    </div>
  );
}

const cardClass = (surface) => "code-stats source-stats-card sh-card" + (surface === "fill" ? " is-fill" : " is-outline");

/**
 * The home mount time (cc43287c9-BMbiZYzF.js:5032 `[E] = T(() => performance.now())`,
 * handed to the hold as Lo startedAt, :5106-5114): captured when `active` turns on,
 * cleared when it turns off, so the delayed reveal counts from the home mount.
 */
export function useHomeStartedAt(active) {
  const startedAt = useRef(null);
  if (!active) startedAt.current = null;
  else if (startedAt.current === null) startedAt.current = performance.now();
  return startedAt.current;
}

// shared-frame-C_2npUJq.js:3161-3167: ic 2000ms wave period, oc 90ms stagger, sc settled offset.
const WAVE_SLOTS = Math.floor(2000 / 90);
const SETTLED_MS = 1e5;
const isReveal = (event) => event.animationName === "cds-placeholder-reveal" && event.target === event.currentTarget;
// hc onAnimationStart (shared-frame :3383-3394): the group is shown; the empty
// sr-only label gets its 'Loading' text only now, so a fast load announces nothing.
function revealStarted(event) {
  if (!isReveal(event)) return;
  event.currentTarget.setAttribute("data-shown", "");
  const label = event.currentTarget.querySelector("[data-skeleton-label]");
  if (label && label.textContent === "") label.textContent = t("Loading");
}
// hc onAnimationEnd (:3377-3382): a settled group never replays the reveal.
function revealEnded(event) {
  if (!isReveal(event)) return;
  event.currentTarget.style.setProperty("--cds-skel-settled", `${SETTLED_MS}ms`);
  event.currentTarget.setAttribute("data-settled", "");
}

/**
 * qw (code-home.js:13863-13924) inside Jt = hc SkeletonGroup (shared-frame :3206-3420,
 * hold "delayed", motion "wave"): role=status, data-hold=delayed keeps the whole card
 * invisible for the .5s cds-placeholder-reveal delay, and each Skeleton breathes with
 * its --cds-skel-i stagger (design-system.css:51761-51838, loaded c6a992d55 CSS).
 * --cds-skel-elapsed is the time since the home mount (`startedAt`), as hc sets it from
 * the Lo context; the indices are static, so they are written at render time like
 * source-transcript-states.jsx. Tabs at half opacity, six 44px tiles, a 120px block
 * and a 12×240px line.
 */
function HoldCard({ surface, startedAt }) {
  const groupRef = useRef(null);
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group || !Number.isFinite(startedAt)) return undefined;
    const elapsed = performance.now() - startedAt;
    if (!(elapsed > 0)) return undefined;
    group.style.setProperty("--cds-skel-elapsed", `${elapsed}ms`);
    return () => group.style.removeProperty("--cds-skel-elapsed");
  }, [startedAt]);
  let index = 0;
  const wave = () => ({ "--cds-skel-i": String(index++ % WAVE_SLOTS) });
  return (
    <div ref={groupRef} data-cds="SkeletonGroup" data-motion="wave" data-hold="delayed" role="status"
      onAnimationStart={revealStarted} onAnimationEnd={revealEnded}>
      <span className="sr-only" data-skeleton-label="" />
      <div aria-hidden="true" className="contents">
        <div className={cardClass(surface)} data-testid="epitaxy-stats-hold">
          <TabsRow tab="overview" range="all" live={false} dimmed />
          <div className="sh-overview">
            <div className="stats-grid sh-grid">
              {Array.from({ length: 6 }, (_, key) => <span key={key} data-cds="Skeleton" className="sh-skeleton sh-skeleton-tile" style={wave()} />)}
            </div>
            <span data-cds="Skeleton" className="sh-skeleton sh-skeleton-block" style={wave()} />
            <span data-cds="Skeleton" className="sh-skeleton sh-skeleton-line" style={wave()} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Jw: "Couldn’t load usage stats" + Retry (disabled with its reason while disconnected). */
function FailedCard({ surface, onRetry, connected, attempts }) {
  const button = (
    <button type="button" className="sh-retry" disabled={!connected} onClick={onRetry}>{t("Retry")}</button>
  );
  return (
    <div className={cardClass(surface)} data-testid="epitaxy-stats-failed" data-stats-attempts={attempts}>
      <div className="sh-failed">
        <span className="sh-failed-text">{t("Couldn’t load usage stats")}</span>
        {onRetry && (connected ? button : <SourceTooltip disabledReason={t("Available when reconnected")}>{button}</SourceTooltip>)}
      </div>
    </div>
  );
}

/** $w (code-home.js:14071-14085): label + value, no tooltip. */
function Tile({ label, value, small }) {
  return (
    <div className="sh-tile">
      <span className="sh-tile-label">{label}</span>
      <span className={"sh-tile-value" + (small ? " is-small" : "")}>{value}</span>
    </div>
  );
}

/**
 * eT (code-home.js:14086-14160): stats.dailyActivity message counts over 26 weeks
 * ending on this week's Saturday; `${date} — ${count}` tooltips mount after a
 * non-touch pointerenter.
 */
function Heatmap({ dailyActivity, todayKey }) {
  const { weeks, max } = useMemo(() => heatmapWeeks(todayKey, activityCounts(dailyActivity)), [dailyActivity, todayKey]);
  const [tooltips, setTooltips] = useState(false);
  return (
    <SourceTooltipGroup>
      <div role="img" aria-label={t("Daily activity heatmap")} className="activity-heatmap sh-heatmap"
        onPointerEnter={tooltips ? undefined : (event) => { if (event.pointerType !== "touch") setTooltips(true); }}>
        {weeks.map((week, index) => (
          <div key={index} className="sh-heatmap-column">
            {week.map((cell) => {
              if (cell.future) return <div key={cell.date} className="sh-heatmap-cell is-future" data-date={cell.date} />;
              const lightness = heatmapLightness(cell.count, max);
              const node = (
                <div key={cell.date} className="sh-heatmap-cell" data-date={cell.date} data-count={cell.count}
                  style={lightness === null ? undefined : { backgroundColor: `hsl(217 70% ${lightness}%)` }} />
              );
              return tooltips
                ? <SourceTooltip key={cell.date} content={`${dayLabel(cell.date)} — ${formatNumber(cell.count)}`} hoverable={false}>{node}</SourceTooltip>
                : node;
            })}
          </div>
        ))}
      </div>
    </SourceTooltipGroup>
  );
}

/** Xw (code-home.js:13969-14046): six tiles, heatmap, book footnote. Peak hour and the heatmap are not ranged. */
function Overview({ stats, ranged, models, todayKey, seed }) {
  const favorite = ranged.modelTotals[0]?.model;
  const favoriteName = favorite ? modelDisplayName(models, favorite) : "—";
  const peak = stats.peakActivityHour == null ? "—"
    : new Intl.DateTimeFormat(getLocale(), { hour: "numeric" }).format(new Date(2000, 0, 1, stats.peakActivityHour));
  const sentence = bookSentence(ranged.totalTokens, seed);
  return (
    <div className="sh-overview">
      <div className="stats-grid sh-grid">
        <Tile label={t("Sessions")} value={formatNumber(ranged.totalSessions)} />
        <Tile label={t("Messages")} value={formatNumber(ranged.totalMessages)} />
        <Tile label={t("Total tokens")} value={compactTokens(ranged.totalTokens)} />
        <Tile label={t("Active days")} value={String(ranged.activeDays)} />
        <Tile label={t("Peak hour")} value={peak} />
        <Tile label={t("Favorite model")} value={favoriteName} small />
      </div>
      <Heatmap dailyActivity={stats.dailyActivity} todayKey={todayKey} />
      {sentence && <span className="stats-footnote sh-footnote">{sentence}</span>}
    </div>
  );
}

function modelDisplayName(models, id) {
  return models.find((entry) => entry.model === id || entry.id === id)?.displayName || id;
}

/** dT (code-home.js:14405-14433): a semibold date, then a 6px round dot + '{model}: {tokens}' per row. */
function DayTooltip({ day, models }) {
  return (
    <span className="sh-day-tooltip">
      <span className="sh-day-tooltip-date">{dayLabel(day.date)}</span>
      {day.segments.map((segment) => (
        <span key={segment.model} className="sh-day-tooltip-row">
          <span className="sh-day-tooltip-dot" aria-hidden="true" style={{ backgroundColor: segment.color }} />
          {`${modelDisplayName(models, segment.model)}: ${compactTokens(segment.tokens)}`}
        </span>
      ))}
    </span>
  );
}

/** lT: 160px grid chart; x labels every Nth day from the measured "Sep 30" probe width + 8px. */
function TokenChart({ chart, models }) {
  const maxTick = chart.ticks.at(-1) ?? 1;
  const plotRef = useRef(null), probeRef = useRef(null);
  const [widths, setWidths] = useState({ plot: 0, probe: 0 });
  useLayoutEffect(() => {
    const plot = plotRef.current, probe = probeRef.current;
    if (!plot || !probe) return undefined;
    const measure = (width) => setWidths({ plot: width, probe: probe.getBoundingClientRect().width });
    measure(plot.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);
  const step = chartLabelStep(chart.days.length, widths.plot, widths.probe);
  return (
    <div role="img" aria-label={t("Daily tokens by model")} data-size="sm" className="sh-chart">
      <div className="sh-chart-axis" aria-hidden="true">
        {chart.ticks.map((tick) => <span key={tick} className="sh-chart-tick">{compactTokens(tick)}</span>)}
      </div>
      <SourceTooltipGroup>
        <div ref={plotRef} className="sh-chart-plot">
          {chart.days.map((day) => (
            <SourceTooltip key={day.date} content={<DayTooltip day={day} models={models} />} multiline hoverable={false}>
              <div data-testid="token-chart-day" className="sh-chart-day" data-date={day.date}>
                {day.segments.map((segment) => (
                  <div key={segment.model} className="sh-chart-segment"
                    style={{ height: `${(segment.tokens / maxTick) * 100}%`, backgroundColor: segment.color }} />
                ))}
              </div>
            </SourceTooltip>
          ))}
        </div>
      </SourceTooltipGroup>
      <div className="sh-chart-labels" aria-hidden="true">
        <span className="sh-chart-probe"><span ref={probeRef} className="sh-chart-probe-text">{dayLabel(LABEL_PROBE_KEY)}</span></span>
        {chart.days.map((day, index) => (
          <span key={day.date} className="sh-chart-label">{index % step === 0 ? dayLabel(day.date) : null}</span>
        ))}
      </div>
    </div>
  );
}

/** cT: chart, then the model list ("{in} in · {out} out", 56px percent column), six rows before Show more. */
function ModelsView({ ranged, models }) {
  const [expanded, setExpanded] = useState(false);
  const chart = useMemo(() => buildChart(ranged.chartDays, ranged.modelKeys), [ranged.chartDays, ranged.modelKeys]);
  const rows = expanded ? ranged.modelTotals : ranged.modelTotals.slice(0, MODEL_ROWS);
  const hidden = ranged.modelTotals.length - rows.length;
  const total = ranged.totalTokens || 1;
  return (
    <div className="sh-models">
      <TokenChart chart={chart} models={models} />
      <div className="sh-model-list">
        {rows.map((entry, index) => (
          <div key={entry.model} className="sh-model-row" data-model={entry.model}>
            <span className="sh-model-swatch" aria-hidden="true" style={{ backgroundColor: modelColor(index) }} />
            <span className="sh-model-name">{modelDisplayName(models, entry.model)}</span>
            <span className="sh-model-io">{t("{input} in · {output} out", { input: compactTokens(entry.usage.inputTokens), output: compactTokens(entry.usage.outputTokens) })}</span>
            <span className="sh-model-pct">{((entry.tokens / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
        {ranged.modelTotals.length === 0 && <span className="sh-model-empty">{t("No model usage in this range")}</span>}
        {ranged.modelTotals.length > MODEL_ROWS && (
          <button type="button" className="sh-model-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? t("Show less") : t("Show {count} more", { count: hidden })}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Rw dispatch (code-home.js:13755-13761): `failed` → Jw card; a stats object → Yw
 * card; otherwise the qw hold skeleton, never zeros. `stats` is the original
 * getCodeStats object (main.cjs 'stats'); `startedAt` is the home mount time.
 */
export function SourceStatsCard({
  stats, models = [], surface = "fill", failed = false, onRetry, connected = true, attempts = 0,
  todayKey, bookSeed, startedAt,
}) {
  const [tab, setTab] = useState("overview"), [range, setRange] = useState("all");
  const [live, setLive] = useState(false);
  const [seed] = useState(() => (Number.isFinite(bookSeed) ? bookSeed : Math.random()));
  const today = todayKey || localDayKey(new Date());
  // Yw (code-home.js:13925-13968): Iw over the raw stats for the tiles and the Models tab.
  const ranged = useMemo(() => (stats ? aggregateStats(stats, range, today) : null), [stats, range, today]);
  if (failed) return <FailedCard surface={surface} onRetry={onRetry} connected={connected} attempts={attempts} />;
  if (!stats) return <HoldCard surface={surface} startedAt={startedAt} />;
  const mount = live ? undefined : () => setLive(true);
  return (
    <div data-testid="epitaxy-stats-card" className={cardClass(surface)} onPointerEnter={mount} onFocusCapture={mount}>
      <TabsRow tab={tab} range={range} live={live} onTab={setTab} onRange={setRange} />
      {tab === "overview"
        ? <Overview stats={stats} ranged={ranged} models={models} todayKey={today} seed={seed} />
        : <ModelsView ranged={ranged} models={models} />}
    </div>
  );
}
