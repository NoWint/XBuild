import React from "react";
import { Icon } from "./icons";
import { goalBlockedReason, goalStatusLabel, goalUsage } from "./goal-model.mjs";
import "./source-goal-strip.css";
import { getLocale, t } from "../electron/i18n/index.mjs";

// The session's goal above the composer (thread/goal/updated; Codex's TUI goal status): the objective, what the
// agent is doing about it, time and tokens used, and Edit / Pause / Resume / Clear where the core takes them. Edit puts
// '/goal edit <objective>' in the composer (Codex's TUI /goal edit). Stop pauses a working goal (main.jsx stop()).
export function SourceGoalStrip({ goal, busy = false, onPause, onResume, onClear, onEdit }) {
  if (!goal || typeof goal.objective !== "string") return null;
  const usage = goalUsage(goal, getLocale()), status = goal.status || "active", blocked = goalBlockedReason(goal);
  return <div className="sgs-strip" role="status" data-status={status}>
    <Icon name="Goal" size={16} className="sgs-icon" />
    <div className="sgs-body">
      <p className="sgs-objective"><span className="sgs-label">{t("Goal")}</span> <bdi>{goal.objective}</bdi></p>
      <p className="sgs-meta">{[goalStatusLabel(status, goal), usage].filter(Boolean).join(" · ")}</p>
      {blocked && <p className="sgs-meta sgs-blocked"><bdi>{blocked}</bdi></p>}
    </div>
    <div className="sgs-actions">
      {onEdit && <button type="button" className="sgs-action" disabled={busy} onClick={onEdit}>{t("Edit")}</button>}
      {status === "active" && onPause && <button type="button" className="sgs-action" disabled={busy} onClick={onPause}>{t("Pause")}</button>}
      {status !== "active" && status !== "complete" && onResume && <button type="button" className="sgs-action" disabled={busy} onClick={onResume}>{t("Resume")}</button>}
      {onClear && <button type="button" className="sgs-action" disabled={busy} onClick={onClear}>{t("Clear")}</button>}
    </div>
  </div>;
}
