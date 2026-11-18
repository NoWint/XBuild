import React, { useEffect, useRef, useState } from "react";
import { SourceDialog, SourceDialogFooter, MODAL_LAYER } from "./source-dialog.jsx";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { SourceMenu } from "./source-menu";
import { BRANCH_SWITCH_LABELS, BRANCH_SWITCH_MODES, otherSessionsNote } from "./branch-picker-model.mjs";
import "./source-branch-switch-dialog.css";
import { t, tn } from "../electron/i18n/index.mjs";

// WR (cc43287c9-BMbiZYzF.js:15913-15918): a branch name inside the copy is <code class="text-code-regular text-primary">.
const BranchName = ({ children }) => <code className="sbs-branch">{children}</code>;
// A translated sentence with the branch name element where its {branch} placeholder is.
const withBranch = (text, branch) => text.split("{branch}").flatMap((part, index) => index ? [<BranchName key={index}>{branch}</BranchName>, part] : [part]);

// KR (:16123-16138): '+a −d' in font-mono-ui text-caption, labelled '{additions} additions, {deletions} deletions'.
function ChangeCounts({ additions, deletions }) {
  return (
    <span className="sbs-counts" aria-label={t("{additions} additions, {deletions} deletions", { additions, deletions })}>
      <span className="sbs-additions">{`+${additions}`}</span>{" "}<span className="sbs-deletions">{`−${deletions}`}</span>
    </span>
  );
}

// mS (shared-frame-C_2npUJq.js:13604-13720) as GR uses it: a joined secondary pair, the primary button labelled with
// the chosen option and a CaretDown 'More options' trigger whose menu (side top, align end) holds the options as
// radio rows. Picking a row only changes the choice; the primary button runs it.
function SplitDropdownButton({ label, busy, disabled, onPrimaryClick, items }) {
  const [anchor, setAnchor] = useState(null);
  return <>
    <div className="sbs-split" role="group" data-cds="SplitDropdownButton" aria-label={label}
      data-popup-open={anchor ? "" : undefined} data-disabled={disabled || undefined}>
      <SourceSettingsButton variant="secondary" className="sbs-split-primary" busy={busy} disabled={disabled} onClick={onPrimaryClick}>{label}</SourceSettingsButton>
      <SourceSettingsButton variant="secondary" className="sbs-split-caret" iconOnly icon="CaretDown" iconSize={16} aria-label={t("More options")}
        aria-haspopup="menu" aria-expanded={!!anchor} disabled={disabled} onClick={(event) => setAnchor(event.currentTarget)} />
    </div>
    {anchor && <SourceMenu.Popup anchor={anchor} side="top" align="end" label={t("More options")} layerBase={MODAL_LAYER.base} onClose={() => setAnchor(null)}>
      {items.map((item) => <SourceMenu.Item key={item.label} checked={item.checked} checkedRole="radio" onClick={item.onSelect}>{item.label}</SourceMenu.Item>)}
    </SourceMenu.Popup>}
  </>;
}

/*
 * GR 'Handle uncommitted changes' (cc43287c9-BMbiZYzF.js:15920-16120) over the shared AlertDialog (to = shared-frame
 * np): picking a branch while the working tree is dirty (worktree off) asks how to clear it first.
 * - Step 1: title 'Uncommitted changes on <b>{currentBranch}</b>', description 'Handle them before switching to
 *   <b>{targetBranch}</b>.', the '{n} files changed' line with +/− counts; footer (align between) Cancel | the split
 *   button over Stash changes / Commit as WIP / Discard changes (default stash). Initial focus on Cancel.
 * - Discard asks again: 'Discard uncommitted changes?' / 'All uncommitted changes on <b>{currentBranch}</b> will be
 *   permanently lost.' with Back | Discard (danger).
 * - x → UR (:15860-15912): busy on the chosen mode; a failed resolve shows the 'Couldn’t update the working tree.'
 *   error (onError) and stays open; success calls onResolved (D(le): the target becomes the chosen branch).
 * - O (onOpenChange false): ignored while busy; on the discard step it goes back; otherwise Cancel keeps the branch.
 * - B34 (:17066-17078): with otherSessionCount > 0 (sessions sharing the folder) step 1 adds the text-body
 *   text-secondary note '{count} other sessions are using this folder. Switching branches will affect them too.'
 */
export function SourceBranchSwitchDialog({ open = true, onExited, currentBranch, targetBranch, status, otherSessionCount = 0, onResolve, onResolved, onCancel, onError }) {
  const [busy, setBusy] = useState(null), [confirmDiscard, setConfirmDiscard] = useState(false), [mode, setMode] = useState("stash");
  const cancelRef = useRef(null), backRef = useRef(null), step = useRef(confirmDiscard);
  useEffect(() => {
    if (step.current === confirmDiscard) return;
    step.current = confirmDiscard;
    if (open) (confirmDiscard ? backRef : cancelRef).current?.focus();
  }, [confirmDiscard, open]);
  const resolve = async (chosen) => {
    // x: focus moves to the dialog itself first, so disabling the pressed button never drops it to <body>.
    (backRef.current ?? cancelRef.current)?.ownerDocument.activeElement?.closest('[role="alertdialog"],[role="dialog"]')?.focus?.({ preventScroll: true });
    setBusy(chosen);
    let resolved = false;
    try {
      const result = await onResolve?.(chosen);
      if (result?.success === false) onError?.(result.error);
      else resolved = true;
    } catch (error) {
      onError?.(error);
    } finally {
      setBusy(null);
      setConfirmDiscard(false);
    }
    if (resolved) onResolved?.();
  };
  const primary = () => { if (mode === "discard") { setConfirmDiscard(true); return; } resolve(mode); };
  const close = () => {
    if (busy !== null) return;
    if (confirmDiscard) { setConfirmDiscard(false); return; }
    onCancel?.();
  };
  const files = status?.files ?? 0, additions = status?.additions ?? 0, deletions = status?.deletions ?? 0;
  const sharedNote = otherSessionsNote(otherSessionCount);
  return (
    <SourceDialog open={open} onExited={onExited} alert size="sm" showClose={false} className="sbs-dialog" descriptionClassName="sbs-description"
      initialFocusRef={cancelRef} onClose={close}
      title={confirmDiscard ? t("Discard uncommitted changes?") : <>{withBranch(t("Uncommitted changes on {branch}"), currentBranch)}</>}
      description={confirmDiscard
        ? <>{withBranch(t("All uncommitted changes on {branch} will be permanently lost."), currentBranch)}</>
        : <>{withBranch(t("Handle them before switching to {branch}."), targetBranch)}</>}>
      {!confirmDiscard && sharedNote && <p className="sbs-shared">{sharedNote}</p>}
      {!confirmDiscard && files > 0 && <p className="sbs-files">
        {tn(files, "{count} file changed", "{count} files changed")}
        {(additions > 0 || deletions > 0) && <ChangeCounts additions={additions} deletions={deletions} />}
      </p>}
      <SourceDialogFooter className="sbs-footer">
        <div className="sbs-footer-group">
          {confirmDiscard
            ? <SourceSettingsButton ref={backRef} variant="secondary" disabled={busy !== null} onClick={() => setConfirmDiscard(false)}>{t("Back")}</SourceSettingsButton>
            : <SourceSettingsButton ref={cancelRef} variant="secondary" disabled={busy !== null} onClick={() => onCancel?.()}>{t("Cancel")}</SourceSettingsButton>}
        </div>
        <div className="sbs-footer-group">
          {confirmDiscard
            ? <SourceSettingsButton variant="danger" busy={busy === "discard"} disabled={busy !== null} onClick={() => resolve("discard")}>{t("Discard")}</SourceSettingsButton>
            : <SplitDropdownButton label={t(BRANCH_SWITCH_LABELS[mode])} busy={busy !== null} disabled={busy !== null} onPrimaryClick={primary}
              items={BRANCH_SWITCH_MODES.map((option) => ({ label: t(BRANCH_SWITCH_LABELS[option]), checked: option === mode, onSelect: () => setMode(option) }))} />}
        </div>
      </SourceDialogFooter>
    </SourceDialog>
  );
}
