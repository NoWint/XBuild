import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceTooltip } from "./source-tooltip.jsx";
import { SourcePopover } from "./source-popover.jsx";
import { AWAITING_OPEN_DELAY_MS, CLOSE_DELAY_MS, awaitingPreview, hoverCardEnabled } from "./action-center-preview-model.mjs";
import { ATTENTION_KINDS, PLACEHOLDER_WIDTHS, narrowRelativeTime, rowLimit, sessionsLimit } from "./home-model.mjs";
import "./source-action-center.css";
import { getLocale, t } from "../electron/i18n/index.mjs";

// 2.2553.1 Action Center (cc43287c9 Zk/Qk/tA/Ak/Dk/Ok/Mk/Nk). Sessions and (B08,
// 2.31226.0 cz/vR) Pull requests have local data sources; Projects is omitted,
// which matches the official null-for-empty rendering. B29: a Needs input row has
// the Fm hover card (AwaitingHoverCard below); prompt suggestion chips (rR, model-
// evaluated "flint" chips) and the Working/Ready-for-review kinds have no local data.

/** tA meta (cc43287c9 :5416-5417, :5473): `owner/name` for a repo with a remote, its name for a local
 *  repo, nothing outside a repo or while the identity (main.cjs 'repo-identities') is unknown. */
export const repoMeta = (identity) => (identity?.owner ? `${identity.owner}/${identity.name}` : identity?.isRepo ? identity.name || undefined : undefined);

function useViewportHeight() {
  const [height, setHeight] = useState(() => (typeof window === "undefined" ? 0 : window.innerHeight));
  useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return height;
}
/** Vk: media-query row limit, capped at five for the Sessions section. */
export function useSessionsLimit() {
  return sessionsLimit(useViewportHeight());
}
/** az j = YR() (:5157): the Pull requests section takes the uncapped row limit. */
export function usePullRequestsLimit() {
  return rowLimit(useViewportHeight());
}

function Pill({ kind }) {
  const label = ATTENTION_KINDS[kind]?.label;
  return (
    <span className="hac-pill">
      <span className="hac-dot-slot"><span className="hac-dot" data-kind={kind} /></span>
      {label !== undefined && <span className="hac-pill-text"><span className="hac-pill-label" data-kind={kind}>{label}</span></span>}
    </span>
  );
}

/** Ak: pill, title, optional subtitle/meta, narrow relative time, caret. */
function RowButton({ kind, title, subtitle, meta, time, now, ...props }) {
  return (
    <button type="button" data-row-main-button="" className="hac-main" {...props}>
      <span className="hac-main-lead">
        <Pill kind={kind} />
        <span className="hac-titles">
          <span className="hac-title">{title}</span>
          {subtitle ? <span className="hac-subtitle">{subtitle}</span> : null}
        </span>
      </span>
      <span className="hac-main-trail">
        {meta ? <span className="hac-meta">{meta}</span> : null}
        <span className="hac-time">
          {time ? <time dateTime={new Date(time).toISOString()}>{narrowRelativeTime(time, now, getLocale())}</time> : null}
        </span>
        <Icon name="CaretRight" size={16} className="hac-caret" />
      </span>
    </button>
  );
}

/** Vse awaiting body (ca0409d7c ue): the pending approval, the agent's question, or V 'Awaiting input'. */
function AwaitingBody({ preview }) {
  if (preview.kind === "approval") return (
    <div className="hac-card-body">
      <span className="hac-card-eyebrow">{preview.title}</span>
      {preview.detail ? <code className="hac-card-detail">{preview.detail}</code> : null}
      <span className="hac-card-note">{t("Open the session to respond")}</span>
    </div>
  );
  if (preview.kind === "question") return (
    <div className="hac-card-body">
      <span className="hac-card-eyebrow">{preview.eyebrow}</span>
      <span className="hac-card-text">{preview.text}</span>
      <span className="hac-card-note">{t("Open the session to respond")}</span>
    </div>
  );
  return (
    <div className="hac-card-body hac-card-waiting">
      <span className="hac-card-status">{t("Awaiting input")}</span>
      <span className="hac-card-note">{t("Open the session to respond")}</span>
    </div>
  );
}

/**
 * Fm/Vse (shared-21): a preview card to the right of the row, opened by hovering (400ms for an awaiting row, closing
 * 200ms after the pointer leaves row and card) or by keyboard focus on the row; touch never opens it, and an open row
 * menu pauses it. 440px wide with the session title (heading-semibold, two lines) above the awaiting body.
 */
function useRowHoverCard(enabled, paused) {
  const [anchor, setAnchor] = useState(null);
  const timers = useRef({ open: 0, close: 0 });
  const clear = () => { clearTimeout(timers.current.open); clearTimeout(timers.current.close); };
  useEffect(() => clear, []);
  useEffect(() => { if (!enabled || paused) { clear(); setAnchor(null); } }, [enabled, paused]);
  const openSoon = (node) => {
    if (!enabled || paused) return;
    clearTimeout(timers.current.close);
    clearTimeout(timers.current.open);
    timers.current.open = setTimeout(() => setAnchor(node), AWAITING_OPEN_DELAY_MS);
  };
  const closeSoon = () => {
    clearTimeout(timers.current.open);
    clearTimeout(timers.current.close);
    timers.current.close = setTimeout(() => setAnchor(null), CLOSE_DELAY_MS);
  };
  const keep = () => clearTimeout(timers.current.close);
  return {
    anchor: enabled && !paused ? anchor : null,
    close: () => { clear(); setAnchor(null); },
    rowProps: enabled ? {
      onPointerEnter: (event) => { if (event.pointerType !== "touch") openSoon(event.currentTarget); },
      onPointerLeave: closeSoon,
      onFocus: (event) => { if (event.target.matches?.(":focus-visible")) openSoon(event.currentTarget); },
      onBlur: (event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeSoon(); },
    } : {},
    cardProps: { onPointerEnter: keep, onPointerLeave: closeSoon },
  };
}

function SessionRow({ row, menuOpen, now, identity, onOpen, onDismiss, onContextMenu }) {
  const { session, kind } = row;
  const name = session.name || session.preview || "";
  const title = name || t("Untitled session");
  const card = useRowHoverCard(hoverCardEnabled({ kind }), !!menuOpen);
  return (
    <li className="hac-row" data-menu-open={menuOpen || undefined} data-attention-kind={kind} data-session-id={session.id} {...card.rowProps}
      onContextMenu={onContextMenu ? (event) => {
        event.preventDefault();
        onContextMenu(session, event.currentTarget.querySelector("[data-row-main-button]"), { x: event.clientX, y: event.clientY });
      } : undefined}>
      <div className="hac-row-body">
        <RowButton kind={kind} title={title} meta={repoMeta(identity)} time={row.timestamp} now={now}
          aria-label={t("Open session {name}", { name })} onClick={() => onOpen(session, kind)} />
      </div>
      {onDismiss && (
        <SourceTooltip content={t("Dismiss")} hoverable={false}>
          <button type="button" className="hac-dismiss" data-row-dismiss="" aria-label={t("Dismiss session")}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onDismiss(session, kind); }}>
            <Icon name="X" size={16} />
          </button>
        </SourceTooltip>
      )}
      {card.anchor && (
        <SourcePopover anchor={card.anchor} side="right" align="center" padding="none" initialFocus={false} dataCds="PreviewCard"
          className="hac-hover-card" onClose={card.close}>
          <div {...card.cardProps} className="hac-card" data-session-hover-card="awaiting">
            <span className="hac-card-title">{title}</span>
            <AwaitingBody preview={awaitingPreview(row.requests)} />
          </div>
        </SourcePopover>
      )}
    </li>
  );
}

/** Qk: null when empty; header with Mark all as read and Show more/less. */
function SessionsSection({ rows, limit, menuOpenId, now, repoIdentities, onOpen, onDismiss, onMarkAllRead, onContextMenu }) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;
  const visible = expanded ? rows : rows.slice(0, limit);
  const hidden = rows.length - visible.length;
  const clearable = rows.some((row) => row.kind === "unread");
  return (
    <section className="hac-section" data-action-center-section="sessions">
      <header className="hac-header">
        <h2 className="hac-heading">{t("Sessions")}</h2>
        <span className="sh-spacer" />
        {clearable && onMarkAllRead && (
          <button type="button" className="hac-ghost" onClick={() => onMarkAllRead(rows.filter((row) => row.kind === "unread").map((row) => row.session))}>
            {t("Mark all as read")}
          </button>
        )}
        {rows.length > limit && (
          <button type="button" className="hac-ghost" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? t("Show less") : t("Show {count} more", { count: hidden })}
          </button>
        )}
      </header>
      <ul role="list" className="hac-list">
        {visible.map((row) => (
          <SessionRow key={row.session.id} row={row} menuOpen={menuOpenId === row.session.id} now={now} identity={repoIdentities?.[row.session.cwd]}
            onOpen={onOpen} onDismiss={onDismiss} onContextMenu={onContextMenu} />
        ))}
      </ul>
    </section>
  );
}

/** vR (cc43287c9 :4414-4545): pill (5px tone dot + footnote label), PR title (else the session's), #number; then the
 * repo slug, the session's narrow time and a caret. A click opens the session's changes (iz onOpenPr); ⌘/Ctrl-click
 * opens the PR on GitHub (dR). The row keeps the session's context menu (Im with prUrlOverride). */
function PullRequestRow({ row, menuOpen, now, onOpenPr, onContextMenu }) {
  const { entry, pill, category } = row;
  const { session, pr, repoSlug } = entry;
  const title = pr.title || session.name || session.preview || t("Untitled session");
  return (
    <li className="hac-row hac-pr-row" data-menu-open={menuOpen || undefined} data-pr-category={category} data-session-id={session.id}
      onContextMenu={onContextMenu ? (event) => {
        event.preventDefault();
        onContextMenu(session, event.currentTarget.querySelector("[data-row-main-button]"), { x: event.clientX, y: event.clientY });
      } : undefined}>
      <button type="button" data-row-main-button="" className="hac-main hac-pr-main" onClick={(event) => onOpenPr?.(entry, category, event)}>
        <span className="hac-pr-lead">
          <span className="hac-pill">
            <span className="hac-dot-slot"><span className="hac-dot" data-tone={pill.tone} /></span>
            <span className="hac-pill-label" data-tone={pill.tone}>{pill.label}</span>
          </span>
          <span className="hac-title">{title}</span>
          <span className="hac-pr-number">{`#${pr.number}`}</span>
        </span>
        <span className="hac-pr-trail">
          <span className="hac-meta">{repoSlug}</span>
          <span className="hac-time">
            {entry.timestamp ? <time dateTime={new Date(entry.timestamp).toISOString()}>{narrowRelativeTime(entry.timestamp, now, getLocale())}</time> : null}
          </span>
          <Icon name="CaretRight" size={16} className="hac-caret" />
        </span>
      </button>
    </li>
  );
}

/** cz (:5451-5520): null when empty; "Pull requests" header with Show {count} more / Show less; urgent rows first. */
function PullRequestsSection({ rows, limit, menuOpenId, now, onOpenPr, onContextMenu }) {
  const [expanded, setExpanded] = useState(false);
  if (!rows?.length) return null;
  const hidden = Math.max(0, rows.length - limit);
  const visible = expanded ? rows : rows.slice(0, limit);
  return (
    <section className="hac-section" data-action-center-section="pull-requests">
      <header className="hac-header">
        <h2 className="hac-heading">{t("Pull requests")}</h2>
        <span className="sh-spacer" />
        {(hidden > 0 || expanded) && (
          <button type="button" className="hac-ghost" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? t("Show less") : t("Show {count} more", { count: hidden })}
          </button>
        )}
      </header>
      <ul role="list" className="hac-list">
        {visible.map((row) => (
          <PullRequestRow key={`${row.entry.session.id}:${row.entry.repoSlug}:${row.entry.pr.number}`} row={row} now={now}
            menuOpen={menuOpenId === row.entry.session.id} onOpenPr={onOpenPr} onContextMenu={onContextMenu} />
        ))}
      </ul>
    </section>
  );
}

/** Zk body when attention rows exist: pt-24 pb-56 column with 40px section gaps. */
export function SourceActionCenter({ rows, limit, menuOpenId, now = Date.now(), repoIdentities, onOpen, onDismiss, onMarkAllRead, onContextMenu,
  prRows = [], prLimit = limit, onOpenPr }) {
  return (
    <div className="source-action-center">
      <SessionsSection rows={rows} limit={limit} menuOpenId={menuOpenId} now={now} repoIdentities={repoIdentities}
        onOpen={onOpen} onDismiss={onDismiss} onMarkAllRead={onMarkAllRead} onContextMenu={onContextMenu} />
      <PullRequestsSection rows={prRows} limit={prLimit} menuOpenId={menuOpenId} now={now} onOpenPr={onOpenPr} onContextMenu={onContextMenu} />
    </div>
  );
}

/** Mk/Nk: aria-hidden skeleton rows mirroring the remembered count; hidden at zero. */
function PlaceholderSection({ title, count, limit, dismissSlot }) {
  if (!count) return null;
  return (
    <section className="hac-section" data-action-center-section="placeholder">
      <header className="hac-header">
        <h2 className="hac-heading">{title}</h2>
        {count > limit && <button type="button" className="hac-ghost is-invisible" tabIndex={-1} aria-hidden="true">{t("Show {count} more", { count: count - limit })}</button>}
      </header>
      <ul role="list" aria-hidden="true" className="hac-list">
        {Array.from({ length: Math.min(count, limit) }, (_, index) => (
          <li key={index} className="hac-row is-placeholder">
            <Pill kind="placeholder" />
            <span className="hac-skeleton-slot"><span data-cds="Skeleton" className="sh-skeleton hac-skeleton-bar" style={{ width: PLACEHOLDER_WIDTHS[index % PLACEHOLDER_WIDTHS.length] }} /></span>
            <Icon name="CaretRight" size={16} className="hac-caret is-invisible" />
            {dismissSlot && <span className="hac-dismiss-slot" />}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SourceActionCenterPlaceholder({ counts, limit, prLimit = limit }) {
  return (
    <div className="source-action-center" aria-busy="true">
      <span className="hac-sr-only" data-skeleton-label="">{t("Loading…")}</span>
      <PlaceholderSection title={t("Sessions")} count={counts?.sessions || 0} limit={limit} dismissSlot />
      <PlaceholderSection title={t("Pull requests")} count={counts?.prs || 0} limit={prLimit} />
    </div>
  );
}
