// Non-dock yk source structure. No official business module is imported.
import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { useApprovalDraft } from "./use-approval-draft.js";
import {
  isQuestionAnswered,
  isQuestionInputSubmit,
} from "./approval-draft-model.mjs";
import { SourceTooltip } from "./source-tooltip.jsx";
import { SourceShortcut } from "./source-shortcut.jsx";
import { currentlyVisible } from "./source-approval-card.jsx";
import { useCardHotkeys } from "./use-card-hotkeys.js";
import "./source-question-card.css";
import { t } from "../electron/i18n/index.mjs";

function hasSelectedText(event) {
  const selection = event.currentTarget.ownerDocument.getSelection();
  return (
    !!selection &&
    !selection.isCollapsed &&
    selection.rangeCount > 0 &&
    selection.getRangeAt(0).intersectsNode(event.currentTarget)
  );
}
const preserveFocus = (event) => event.preventDefault();
function RadioMark({ checked }) {
  return (
    <span
      className="sq-radio-mark"
      aria-hidden="true"
      data-checked={checked ? "" : undefined}
    >
      {checked && <span className="sq-radio-dot" />}
    </span>
  );
}
// A multiSelect question's mark is the CDS checkbox (shared-frame Th, imported as li:
// approval-current.js:7838 `b(r ? li : ok …)`, :8085-8088 for Other): a square
// size-[--cds-checkbox] rounded-[--cds-checkbox-radius] border-strong box, filled
// bg-fill-accent with a bold Check in text-on-accent once checked.
function CheckboxMark({ checked }) {
  return (
    <span
      className="sq-checkbox-mark"
      aria-hidden="true"
      data-checked={checked ? "" : undefined}
      data-unchecked={checked ? undefined : ""}
    >
      {checked && <Icon name="Check" size={14} weight="strong" className="sq-checkbox-glyph"
        style={{ fontSize: "var(--cds-checkbox-glyph, 14px)" }} />}
    </span>
  );
}
function BusySpinner() {
  return (
    <span className="sq-spinner" aria-hidden="true" data-cds="Spinner">
      <span className="sq-spinner-track" />
      <span className="sq-spinner-arc" />
    </span>
  );
}

export function SourceQuestionCard({
  runtime,
  request,
  getVisibleThreadId,
  respond,
  onResolved = () => {},
  onError = () => {},
  skipEnter = false,
  isActive = true,
  menuOpen = false,
}) {
  const { ticket, view } = useApprovalDraft(runtime, request);
  const root = useRef(null),
    restorePageFocus = useRef(null);
  const questionId = useId();
  const page = view?.draft.page;
  useLayoutEffect(() => {
    const wanted = restorePageFocus.current;
    restorePageFocus.current = null;
    if (
      wanted?.key === ticket?.key &&
      wanted?.generation === ticket?.generation &&
      wanted?.page === page
    )
      root.current?.focus({ preventScroll: true });
  }, [ticket, page]);
  // Option previews (a core's mockups / code variants, approval-current.js:7708): the hovered or focused option's.
  const [previewAt, setPreviewAt] = useState(null);
  // yk's ep({ active, allowOnce: K }) (approval-current.js:8011-8023) is document-level: ⌘⏎ advances from the
  // session's empty composer or an unfocused page too (use-card-hotkeys). It registers no deny, so Esc is left to
  // the composer, which main.jsx keeps from stopping the turn while a card waits. Set below, after the guards.
  const advanceKey = useRef(null);
  useCardHotkeys(root, isActive && !menuOpen && view?.phase === "pending" && !view.busy, (key, event) => {
    if (key === "escape" || !isQuestionInputSubmit(event)) return;
    advanceKey.current?.(event);
  }, currentlyVisible);
  advanceKey.current = null;
  if (!view || !["pending", "invalid"].includes(view.phase)) return null;
  const question = view.questions[page];
  if (view.schemaError || !question)
    return (
      <section
        ref={root}
        className="source-message source-question-card sq-card"
        role="group"
        aria-label={t("Question request")}
        data-approval-instance={ticket.bridgeApproval.instanceId}
        data-approval-connection={ticket.bridgeApproval.connectionId}
        data-approval-request-id={String(ticket.requestId)}
        data-approval-request-id-type={typeof ticket.requestId}
        data-approval-presentation="card"
        data-approval-invalid=""
        data-skip-approval-enter={skipEnter ? "" : undefined}
      >
        <p className="sq-error" role="alert">
          {view.schemaError || t("This request did not include any questions.")}
        </p>
      </section>
    );
  const answer = view.draft.answers[question.id];
  const last = page === view.questions.length - 1;
  const hasOptions = question.options.length > 0;
  const multi = question.multiSelect === true;
  const custom = multi ? answer.otherSelected === true : ["other", "free"].includes(answer.choice?.kind);
  const optionSelected = (label) => multi
    ? (answer.selected ?? []).includes(label)
    : answer.choice?.kind === "option" && answer.choice.label === label;
  const Mark = multi ? CheckboxMark : RadioMark;
  // A single-select question whose options carry previews shows them beside the list: the hovered or focused
  // option's, else the chosen one's, else the first.
  const previewed = !multi && question.options.some((option) => typeof option.preview === "string" && option.preview);
  const chosenIndex = question.options.findIndex((option) => optionSelected(option.label));
  const previewOption = previewed ? question.options[previewAt ?? (chosenIndex >= 0 ? chosenIndex : 0)] ?? question.options[0] : null;
  const unavailable = view.busy || !isActive;
  const canAdvance = isActive && !menuOpen && runtime.canAdvance(ticket);
  // approval-current.js:7975-7987: U = first page other than M that is not uk-answered (skipped
  // counts); G = W ? undefined : k(M) ? 'Question {U+1} is unanswered' : 'Choose an option or
  // skip this question' — one string for option, Other and free-form pages alike. k(M) && !W only
  // happens on the last page. 'not currently active' is this app's inactive/menu-open guard.
  const unanswered = view.questions.findIndex(
    (item, index) =>
      index !== page && !isQuestionAnswered(item, view.draft.answers[item.id]),
  );
  const disabledReason =
    canAdvance || view.busy
      ? undefined
      : last && unanswered >= 0 && isQuestionAnswered(question, answer)
        ? t("Question {number} is unanswered", { number: unanswered + 1 })
        : !isActive || menuOpen
          ? t("This request is not currently active")
          : t("Choose an option or skip this question");
  const navigate = (next) => {
    if (unavailable || menuOpen) return;
    const active = root.current?.ownerDocument.activeElement;
    if (root.current?.contains(active))
      restorePageFocus.current = {
        key: ticket.key,
        generation: ticket.generation,
        page: next,
      };
    if (!runtime.setPage(ticket, next)) restorePageFocus.current = null;
  };
  const advance = async () => {
    if (!isActive || menuOpen || !runtime.canAdvance(ticket)) return;
    if (!last) {
      navigate(page + 1);
      return;
    }
    const result = await runtime.submit(ticket, null, respond, {
      getVisibleThreadId,
    });
    if (result.status === "answered")
      onResolved({ request, ticket: result.ticket });
    else if (result.status === "error")
      onError({ request, ticket: result.ticket, message: result.message });
  };
  // Source Skip q (approval-current.js:7997-8008) via runtime.skip; same guards as advance.
  // The page change keeps navigate()'s focus restoration (the skipped page's options unmount).
  const skip = async () => {
    if (unavailable || menuOpen) return;
    const next = last ? unanswered : page + 1;
    if (next >= 0 && root.current?.contains(root.current.ownerDocument.activeElement))
      restorePageFocus.current = {
        key: ticket.key,
        generation: ticket.generation,
        page: next,
      };
    const result = await runtime.skip(ticket, respond, { getVisibleThreadId });
    if (result.status !== "page") restorePageFocus.current = null;
    if (result.status === "answered")
      onResolved({ request, ticket: result.ticket });
    else if (result.status === "error")
      onError({ request, ticket: result.ticket, message: result.message });
  };
  advanceKey.current = (event) => {
    if (!runtime.canAdvance(ticket)) return;
    event.preventDefault();
    event.stopPropagation();
    if (currentlyVisible(root.current)) void advance();
  };
  const customProps = {
    className: "sq-custom-control",
    value: answer.customText,
    disabled: unavailable,
    tabIndex: !hasOptions || custom ? 0 : -1,
    "aria-label": hasOptions
      ? t("Other option")
      : question.header || question.question,
    placeholder: hasOptions ? t("Type your own answer here") : t("Write your answer"),
    autoComplete: "off",
    spellCheck: !question.isSecret,
    onFocus: () => { if (!custom) runtime.selectOther(ticket, question.id, { toggle: false }); },
    onChange: (event) =>
      runtime.writeCustom(ticket, question.id, event.target.value),
    onKeyDown: (event) => {
      if (
        isActive &&
        !menuOpen &&
        isQuestionInputSubmit(event) &&
        runtime.canAdvance(ticket)
      ) {
        event.preventDefault();
        event.stopPropagation();
        void advance();
      }
    },
  };
  return (
    <section
      ref={root}
      className="source-message source-question-card sq-card"
      role="group"
      tabIndex={-1}
      aria-labelledby={questionId}
      aria-busy={view.busy}
      data-approval-instance={ticket.bridgeApproval.instanceId}
      data-approval-connection={ticket.bridgeApproval.connectionId}
      data-approval-request-id={String(ticket.requestId)}
      data-approval-request-id-type={typeof ticket.requestId}
      data-approval-question-id={question.id}
      data-question-page={page}
      data-approval-presentation="card"
      data-skip-approval-enter={skipEnter ? "" : undefined}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // yk registers ep({ active, allowOnce: K }) (approval-current.js:8011-8023), so the
        // advertised ⌘⏎ keycap advances from anywhere in the card, not only the Other input
        // (which handles and stops the event itself). Card-scoped like SourceApprovalCardView.
        if (
          !isQuestionInputSubmit(event) ||
          !isActive ||
          menuOpen ||
          !runtime.canAdvance(ticket)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        void advance();
      }}
    >
      <header className="sq-header">
        <div id={questionId} className="sq-question">
          {question.question}
        </div>
        {view.questions.length > 1 && (
          <span className="sq-progress">
            <button
              type="button"
              className="sq-nav"
              data-size="sm"
              aria-label={t("Show previous question")}
              disabled={unavailable || menuOpen || page === 0}
              onMouseDown={preserveFocus}
              onClick={() => navigate(page - 1)}
            >
              <Icon name="CaretLeft" size={12} />
            </button>
            <span aria-live="polite">
              {t("{current} of {total}", { current: page + 1, total: view.questions.length })}
            </span>
            <button
              type="button"
              className="sq-nav"
              data-size="sm"
              aria-label={t("Show next question")}
              disabled={unavailable || menuOpen || last}
              onMouseDown={preserveFocus}
              onClick={() => navigate(page + 1)}
            >
              <Icon name="CaretRight" size={12} />
            </button>
          </span>
        )}
      </header>
      <div className={previewed ? "sq-preview-layout" : undefined} data-option-previews={previewed ? "" : undefined}>
      <div className="sq-options">
        {question.options.map((option, index) => (
          <button
            key={`${index}:${option.label}`}
            type="button"
            className="sq-option"
            aria-pressed={optionSelected(option.label)}
            disabled={unavailable}
            onMouseEnter={previewed ? () => setPreviewAt(index) : undefined}
            onFocus={previewed ? () => setPreviewAt(index) : undefined}
            onClick={(event) => {
              if (!hasSelectedText(event))
                runtime.selectOption(ticket, question.id, option.label);
            }}
          >
            <Mark checked={optionSelected(option.label)} />
            <span className="sq-option-copy">
              <span>{option.label}</span>
              {option.description && (
                <span className="sq-option-description">
                  {option.description}
                </span>
              )}
            </span>
          </button>
        ))}
        {(!hasOptions || question.isOther) && (
          <div
            className={`sq-option sq-custom ${hasOptions ? "" : "sq-freeform"}`}
          >
            {hasOptions && (
              <>
                <button
                  type="button"
                  className="sq-custom-select"
                  aria-label={t("Other")}
                  aria-pressed={custom}
                  disabled={unavailable}
                  onClick={(event) => {
                    if (!hasSelectedText(event))
                      runtime.selectOther(ticket, question.id);
                  }}
                />
                <span className="sq-custom-label" aria-hidden="true">
                  <Mark checked={custom} />
                  <span>{t("Other")}</span>
                </span>
              </>
            )}
            {question.isSecret ? (
              <input {...customProps} type="password" />
            ) : (
              <textarea {...customProps} rows={1} />
            )}
          </div>
        )}
      </div>
      {previewed && (
        <pre className="sq-preview" tabIndex={0} aria-label={t("Preview of {option}", { option: previewOption?.label ?? "" })} data-preview-for={previewOption?.label}>
          {previewOption?.preview || t("No preview for this option.")}
        </pre>
      )}
      </div>
      {view.error && (
        <p className="sq-error" role="alert">
          {view.error}
        </p>
      )}
      {/* approval-current.js:8232-8258: `div.epitaxy-approval-actions flex items-center
          justify-end gap-sm` holds br{variant "secondary", onMouseDown hk, onClick q, disabled: l}
          'Skip' before the primary Next/Submit (busy, disabledReason, shortcut cmd+enter). */}
      <footer className="sq-actions">
        <button
          type="button"
          className="sq-skip"
          data-variant="secondary"
          disabled={unavailable || menuOpen}
          onMouseDown={preserveFocus}
          onClick={() => void skip()}
        >
          {t("Skip")}
        </button>
        <SourceTooltip disabledReason={disabledReason}>
          <button
            type="button"
            className="sq-submit"
            aria-busy={view.busy || undefined}
            aria-disabled={view.busy || undefined}
            disabled={!isActive || menuOpen || (!view.busy && !canAdvance)}
            onMouseDown={preserveFocus}
            onKeyDown={(event) => {
              if (
                (event.key === "Enter" || event.key === " ") &&
                (unavailable || menuOpen || event.repeat)
              )
                event.preventDefault();
            }}
            onClick={(event) => {
              if (unavailable || menuOpen) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              void advance();
            }}
          >
            <span
              className="sq-submit-label"
              aria-hidden={view.busy || undefined}
            >
              {last ? t("Submit") : t("Next")}
              {/* approval-current.js:8249-8256 `shortcut: a ? "cmd+enter"`; the CDS Button
                  (shared-frame :2886, :2936-2944) keeps it in the busy-faded content span. */}
              {isActive && !menuOpen && (
                <SourceShortcut
                  keys="cmd+enter"
                  aria-hidden="true"
                  className="scds-in-button scds-trailing"
                />
              )}
            </span>
            {view.busy && (
              <span className="sq-submit-busy">
                <BusySpinner />
                <span className="sq-visually-hidden">{t("Submitting answer")}</span>
              </span>
            )}
          </button>
        </SourceTooltip>
      </footer>
    </section>
  );
}
