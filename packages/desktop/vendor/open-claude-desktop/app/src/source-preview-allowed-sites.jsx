import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SourceDialog } from "./source-dialog";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { allowedSiteError, allowedSiteLabel, orderedAllowedSites, removeFocusTarget } from "./preview-allowed-sites-model.mjs";
import { assistantName } from "./persona-store.mjs";
import { t } from "../electron/i18n/index.mjs";
import "./source-preview-allowed-sites.css";

// B39 Allowed sites: the 2.31226.0 PreviewAllowedSitesModal (c25b1be4a-C8MgNjI5 _, loaded through ce3a18f86 er /
// cdc95db1a m) over its view (c36734a81-B0yxtrZx: x the dialog shell, b the card, _ the add field and rows, h the
// focus fallback). The list is the main process's saved allow list (electron/preview-allowed-origins.mjs through
// preview-allowed-origins / -add / -remove / -clear), consulted before the agent's preview tools ask about a site.

// c36734a81 h: focus a node unless focus already moved somewhere live.
function focusFallback(node) {
  if (!node) return;
  const active = node.ownerDocument.activeElement;
  if (active === null || active === node.ownerDocument.body || active.contains(node) || active.matches(":disabled")) node.focus();
}

// c36734a81 _ (readable 39-207): the Add URL field (Enter adds, IME-safe), its alert, and the rows — saved sites first,
// then built-in ones; each saved row's Trash removes it and focus moves to the next row, else the previous, else the field.
function AllowedSitesList({ entries, canAdd = true, draft = "", onDraftChange, draftError, addPending, pendingOrigin, onAdd, onRemove, addInputRef, removeFocusFallbackRef, labels }) {
  const inputId = useId(), errorId = useId();
  const rowButtons = useRef(new Map()), input = useRef(null), removing = useRef(null);
  useLayoutEffect(() => {
    const current = removing.current;
    if (!current) return;
    if (entries.some((entry) => entry.origin === current.origin)) {
      if (pendingOrigin === current.origin) current.sawPending = true;
      else if (current.sawPending && pendingOrigin == null) { removing.current = null; focusFallback(rowButtons.current.get(current.origin)); }
      return;
    }
    if (pendingOrigin === current.origin) return;
    removing.current = null;
    const next = removeFocusTarget(current, entries);
    focusFallback(next ? rowButtons.current.get(next) : canAdd ? input.current : removeFocusFallbackRef?.current);
  }, [entries, pendingOrigin, canAdd, removeFocusFallbackRef]);
  const rows = orderedAllowedSites(entries);
  return (
    <div className="spas-body">
      {canAdd && <div className="spas-add">
        <label htmlFor={inputId} className="spas-add-label">{labels.addUrl}</label>
        <div className="spas-add-field">
          <input id={inputId} ref={(node) => { input.current = node; if (addInputRef) addInputRef.current = node; }} type="text" value={draft}
            onChange={(event) => onDraftChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229 || event.key !== "Enter") return;
              event.preventDefault();
              if (draft.trim() === "" || addPending) return;
              onAdd?.();
            }}
            spellCheck={false} aria-invalid={!!draftError} aria-describedby={draftError ? errorId : undefined} placeholder={labels.addPlaceholder}
            className="spas-add-input hide-focus-ring" />
          <SourceSettingsButton size="sm" variant="secondary" icon="Add" iconSize="auto" iconOnly busy={addPending} disabled={draft.trim() === ""}
            aria-label={labels.add} onClick={onAdd} className="shrink-0" />
        </div>
        {draftError && <div id={errorId} role="alert" className="spas-add-error">{draftError}</div>}
      </div>}
      {rows.length === 0
        ? <div className="spas-empty">{labels.empty}</div>
        : <div className="spas-rows scroll-fade-y" data-allowed-sites="">
          {rows.map((entry) => {
            const label = allowedSiteLabel(entry);
            return (
              <div key={entry.origin} className="spas-row" data-builtin={entry.builtin ? "" : undefined} data-allowed-origin={entry.origin}>
                <span className="spas-row-label">{label}</span>
                {entry.caption !== undefined && <span className="spas-row-caption">{entry.caption}</span>}
                {entry.builtin
                  ? <span className="spas-row-builtin">{labels.builtin}</span>
                  : <SourceSettingsButton ref={(node) => { if (node) rowButtons.current.set(entry.origin, node); else rowButtons.current.delete(entry.origin); }}
                    variant="ghost" icon="Trash" iconSize="auto" iconOnly busy={pendingOrigin === entry.origin}
                    disabled={pendingOrigin != null && pendingOrigin !== entry.origin} aria-label={labels.remove(label)} className="shrink-0"
                    onClick={() => {
                      const saved = rows.filter((row) => !row.builtin).map((row) => row.origin), index = saved.indexOf(entry.origin);
                      removing.current = { origin: entry.origin, successors: saved.slice(index + 1), predecessors: saved.slice(0, index).reverse(), sawPending: false };
                      onRemove(entry.origin);
                    }} />}
              </div>
            );
          })}
        </div>}
    </div>
  );
}

/**
 * c25b1be4a _ + c36734a81 x/b: the dialog. While a remove, an add or Clear all is in flight it can't be dismissed (x's
 * onOpenChange guard); a reopen drops the draft, the error and the old list (the A generation counter drops late answers).
 */
export function SourcePreviewAllowedSites({ isOpen, onClose, desktop = globalThis.desktop, layer }) {
  const [entries, setEntries] = useState([]);
  const [pendingOrigin, setPendingOrigin] = useState(null);
  const [draft, setDraft] = useState("");
  const [addPending, setAddPending] = useState(false);
  const [draftError, setDraftError] = useState(null);
  const [clearing, setClearing] = useState(false);
  const addInput = useRef(null), done = useRef(null), clearAll = useRef(null), generation = useRef(0);
  const call = useCallback((action, params) => (desktop?.call ? desktop.call(action, params ?? {}) : Promise.reject(new Error("unavailable"))), [desktop]);
  const canAdd = !!desktop?.call;
  useEffect(() => {
    generation.current += 1;
    if (!isOpen) return undefined;
    setDraft(""); setDraftError(null); setAddPending(false); setPendingOrigin(null); setEntries([]);
    let cancelled = false;
    call("preview-allowed-origins").then((list) => { if (!cancelled) setEntries(Array.isArray(list) ? list : []); }, () => {});
    return () => { cancelled = true; };
  }, [isOpen, call]);
  const refresh = useCallback(async () => {
    const at = generation.current, list = await call("preview-allowed-origins");
    if (generation.current === at) setEntries(Array.isArray(list) ? list : []);
  }, [call]);
  const remove = useCallback(async (origin) => {
    const at = generation.current;
    setDraftError(null); setPendingOrigin(origin);
    try { await call("preview-allowed-origin-remove", { origin }); await refresh(); } catch { /* the row stays */ }
    finally { if (generation.current === at) setPendingOrigin((value) => (value === origin ? null : value)); }
  }, [call, refresh]);
  const add = useCallback(async () => {
    const value = draft.trim();
    if (!value || addPending) return;
    const at = generation.current;
    setAddPending(true); setDraftError(null);
    const schemeless = !value.includes("://");
    let result;
    try { result = (await call("preview-allowed-origin-add", { origin: schemeless ? `https://${value}` : value, schemeless })) ?? "unavailable"; } catch { result = "unavailable"; }
    if (generation.current !== at) return;
    setAddPending(false);
    if (result === "ok") {
      const typed = draft;
      setDraft((current) => (current === typed ? "" : current));
      await refresh().catch(() => undefined);
      if (generation.current === at) focusFallback(addInput.current);
    } else {
      if (result !== "declined") setDraftError(allowedSiteError(result, t));
      focusFallback(addInput.current);
    }
  }, [draft, addPending, call, refresh]);
  const clear = useCallback(async () => {
    setDraftError(null); setClearing(true);
    try { await call("preview-allowed-origins-clear"); await refresh(); } catch { /* kept */ }
    finally { setClearing(false); }
  }, [call, refresh]);
  // b: after Clear all, focus goes back to Clear all while saved rows remain, else to Done.
  const wasClearing = useRef(false);
  useLayoutEffect(() => {
    const was = wasClearing.current;
    wasClearing.current = clearing;
    if (was && !clearing) focusFallback((entries.some((entry) => !entry.builtin) ? clearAll : done).current);
  }, [clearing, entries]);
  const busy = clearing || pendingOrigin !== null || addPending;
  // x's onOpenChange guard holds Escape and an outside press while anything is in flight; b's X and Done close directly
  // and are only disabled during Clear all.
  const close = useCallback((reason) => { if (reason === "close-press" ? !clearing : !busy) onClose?.(); }, [busy, clearing, onClose]);
  const labels = useMemo(() => ({
    addUrl: t("Add URL"), addPlaceholder: t("example.com"), add: t("Add"), builtin: t("Built-in"),
    remove: (host) => t("Remove {host}", { host }), empty: t("No allowed sites yet."),
  }), []);
  return (
    <SourceDialog open={!!isOpen} onClose={close} size="sm" {...(layer ? { layer } : {})} density="compact" className="spas-dialog" data-preview-allowed-sites=""
      title={t("Allowed sites")} initialFocusRef={canAdd ? addInput : undefined}
      description={t("{assistant} can use its Browser tools on these sites without a permission prompt. Remove a site and {assistant} asks again the next time that site needs your approval.", { assistant: assistantName() })}>
      <AllowedSitesList entries={entries} canAdd={canAdd} draft={draft} onDraftChange={(value) => { setDraft(value); setDraftError(null); }} draftError={draftError}
        addPending={addPending} pendingOrigin={pendingOrigin} onAdd={() => void add()} onRemove={(origin) => void remove(origin)}
        addInputRef={addInput} removeFocusFallbackRef={done} labels={labels} />
      <div className="spas-footer">
        <SourceSettingsButton ref={clearAll} variant="danger" busy={clearing} disabled={!entries.some((entry) => !entry.builtin)} onClick={() => void clear()}>{t("Clear all")}</SourceSettingsButton>
        <SourceSettingsButton ref={done} variant="primary" disabled={clearing} onClick={() => onClose?.()}>{t("Done")}</SourceSettingsButton>
      </div>
    </SourceDialog>
  );
}
