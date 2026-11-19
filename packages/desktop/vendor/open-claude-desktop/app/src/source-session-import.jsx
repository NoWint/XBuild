import React, { useEffect, useMemo, useState } from "react";
import { ActionDialog } from "./source-session-actions.jsx";
import { SourceDialogFooter } from "./source-dialog.jsx";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { pathBasename } from "./host-path-model.mjs";
import { resumeActivityLabel } from "./source-resume-dialog.jsx";
import { getAssistantName, t, tn } from "../electron/i18n/index.mjs";
import "./source-claude-import.css";

// Settings › Code › Import sessions (main.cjs 'session-import', electron/session-import.cjs): the host reads the local
// history of other tools (Claude Code, Codex, ZCode, DeepSeek Harness), this dialog lists what it found by title, folder
// and time, the user picks sessions, and the chosen ones go to the running core as sessions they can carry on with.
// Nothing outside this Mac is read or sent, the other tools' stores are only read, and a source session that is still
// running is offered as skipped (an import never claims a live conversation is finished).
const SOURCE_LABELS = { claude: () => t("Claude Code"), codex: () => t("Codex"), zcode: () => t("ZCode"), deepseek: () => t("DeepSeek Harness") };
export const sessionImportSourceLabel = (source) => (SOURCE_LABELS[source] ? SOURCE_LABELS[source]() : String(source));

const folderName = (cwd) => (typeof cwd === "string" && cwd ? pathBasename(cwd) || cwd : "");

/** The flat rows the dialog shows: one per found session, each tagged with its source. */
export function sessionImportRows(detected) {
  const rows = [];
  for (const [source, entry] of Object.entries(detected || {})) for (const session of entry?.sessions ?? []) rows.push({ ...session, source });
  return rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** What the import did, in one sentence (the summary the settings row keeps too). */
export function sessionImportSummary(sources) {
  const totals = Object.values(sources ?? {}).reduce((sum, entry) => ({
    imported: sum.imported + (entry?.imported ?? 0), skipped: sum.skipped + (entry?.skipped ?? 0), failed: sum.failed + (entry?.failed ?? 0),
  }), { imported: 0, skipped: 0, failed: 0 });
  if (!totals.imported && !totals.skipped && !totals.failed) return t("Nothing to import was found.");
  return t("Imported {imported} sessions. {skipped} were already here or still running; {failed} could not be imported.",
    { imported: totals.imported, skipped: totals.skipped, failed: totals.failed });
}

export function SessionImportDialog({ desktopCall, onDone, onClose, ...dialog }) {
  const [detected, setDetected] = useState(null), [chosen, setChosen] = useState(() => new Set());
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [result, setResult] = useState(null);
  const [source, setSource] = useState("all");
  useEffect(() => {
    let live = true;
    Promise.resolve(desktopCall("session-import", { op: "detect" })).then((value) => {
      if (!live) return;
      const sources = value?.sources ?? {};
      const rows = sessionImportRows(sources).filter((row) => row.status !== "running");
      setDetected(sources);
      setChosen(new Set(rows.filter((row) => row.targetThreadId).map((row) => row.sourceKey)));
    }, (failure) => { if (live) { setDetected({}); setError(failure?.message || String(failure)); } });
    return () => { live = false; };
  }, []);
  const rows = useMemo(() => sessionImportRows(detected), [detected]);
  const counts = useMemo(() => Object.fromEntries(Object.entries(detected ?? {}).map(([key, entry]) => [key,
    { total: entry?.sessions?.length ?? 0, selectable: (entry?.sessions ?? []).filter((session) => session.status !== "running").length }])), [detected]);
  const shown = rows.filter((row) => source === "all" || row.source === source);
  const found = rows.filter((row) => row.status !== "running");
  const toggle = (key, on) => setChosen((current) => { const next = new Set(current); if (on) next.add(key); else next.delete(key); return next; });
  const run = async () => {
    setBusy(true); setError("");
    try {
      const sources = [...new Set(shown.filter((row) => chosen.has(row.sourceKey)).map((row) => row.source))];
      const value = await desktopCall("session-import", { op: "import", sources: source === "all" ? undefined : sources.length ? sources : [source] });
      const answer = value?.sources ?? {};
      setResult(answer); onDone?.(answer);
    } catch (failure) { setError(failure?.message || String(failure)); }
    finally { setBusy(false); }
  };
  const core = getAssistantName();
  if (result) {
    const imported = Object.values(result).reduce((sum, entry) => sum + (entry?.imported ?? 0), 0);
    return <ActionDialog {...dialog} title={t("Import sessions")} className="claude-import-dialog" onClose={onClose}>
      <p role="status">{sessionImportSummary(result)}</p>
      <ul className="claude-import-failures">
        {Object.entries(result).filter(([, entry]) => (entry?.failed ?? 0) > 0).map(([key, entry]) =>
          <li key={key}><strong>{sessionImportSourceLabel(key)}</strong> {tn(entry.failed, "{count} session could not be imported.", "{count} sessions could not be imported.", { count: entry.failed })}</li>)}
      </ul>
      {imported > 0 && <p className="claude-import-muted">{t("Open them from Resume a session, or in the sidebar. {core} keeps them like your own conversations.", { core })}</p>}
      <SourceDialogFooter><SourceSettingsButton variant="primary" data-autofocus onClick={onClose}>{t("Done")}</SourceSettingsButton></SourceDialogFooter>
    </ActionDialog>;
  }
  return <ActionDialog {...dialog} title={t("Import sessions")} className="claude-import-dialog" onClose={() => !busy && onClose()}>
    <p>{t("Bring conversations from other tools into {core}. This Mac’s files are only read; nothing is sent anywhere, and imported sessions can be continued like any other.", { core })}</p>
    {detected === null ? <p role="status" className="claude-import-muted">{t("Looking for conversations from other tools…")}</p>
      : rows.length === 0 ? <p className="claude-import-muted">{t("Nothing to import was found.")}</p> : null}
    {rows.length > 0 && <>
      <div className="claude-import-sources" role="group" aria-label={t("Where to import from")}>
        {[{ key: "all", label: t("All tools"), total: rows.length }, ...Object.entries(counts).filter(([, entry]) => entry.total > 0).map(([key, entry]) => ({ key, label: sessionImportSourceLabel(key), total: entry.total }))]
          .map((entry) => <SourceSettingsButton key={entry.key} size="sm" variant={source === entry.key ? "secondary" : "ghost"} disabled={busy} onClick={() => setSource(entry.key)}>
            {entry.label} <span className="claude-import-count">{entry.total}</span></SourceSettingsButton>)}
      </div>
      <div className="claude-import-list" role="group" aria-label={t("Sessions to import")}>
        {shown.map((row) => <label key={row.sourceKey} className="claude-import-item" data-session-key={row.sourceKey}>
          <input type="checkbox" checked={row.status !== "running" && chosen.has(row.sourceKey)} disabled={busy || row.status === "running"}
            onChange={(event) => toggle(row.sourceKey, event.target.checked)} />
          <span><strong>{row.title || t("Untitled session")}</strong>
            <span className="claude-import-muted">{row.status === "running" ? t("Still running in {tool}; it can be imported once it finishes.", { tool: sessionImportSourceLabel(row.source) })
              : [sessionImportSourceLabel(row.source), folderName(row.cwd), row.updatedAt ? resumeActivityLabel(Math.floor(row.updatedAt / 1000)) : ""].filter(Boolean).join(" · ")}</span></span>
        </label>)}
      </div>
    </>}
    {error && <p role="alert" className="claude-import-error">{error}</p>}
    <SourceDialogFooter><SourceSettingsButton data-autofocus disabled={busy} onClick={onClose}>{t("Cancel")}</SourceSettingsButton>
      <SourceSettingsButton variant="primary" busy={busy} disabled={!source || !shown.some((row) => chosen.has(row.sourceKey))} onClick={() => void run()}>
        {tn(Math.max(0, shown.filter((row) => chosen.has(row.sourceKey)).length), "Import {count} session", "Import {count} sessions", { count: shown.filter((row) => chosen.has(row.sourceKey)).length })}
      </SourceSettingsButton></SourceDialogFooter>
  </ActionDialog>;
}
