// Codex's asynchronous questions (request_user_input_async) under the message that asks them. The turn keeps
// running, so this card never blocks the composer: picking an option or typing an answer and pressing Send answers
// as an ordinary message (steered into the running turn, or as the next turn); Skip dismisses it. Same look as the
// question card (sq-*), without its approval plumbing.
import React, { createContext, useContext, useId, useState } from "react";
import { Icon } from "./icons.jsx";
import { asyncAnswerText, asyncQuestionsOf } from "./async-questions-model.mjs";
import "./source-question-card.css";
import "./source-async-questions.css";
import { t } from "../electron/i18n/index.mjs";

/** { settled: Set<itemId>, answer(itemId, text) → Promise, skip(itemId), canAnswer: boolean } from the session view. */
export const AsyncQuestionsContext = createContext(null);

function RadioMark({ checked }) {
  return <span className="sq-radio-mark" aria-hidden="true" data-checked={checked ? "" : undefined}>{checked && <span className="sq-radio-dot" />}</span>;
}

export function SourceAsyncQuestions({ item }) {
  const context = useContext(AsyncQuestionsContext);
  const questions = asyncQuestionsOf(item);
  const [page, setPage] = useState(0);
  const [choices, setChoices] = useState({}); // page → {kind: 'option', label} | {kind: 'other'}
  const [texts, setTexts] = useState({}); // page → typed answer
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const questionId = useId();
  if (!context || !questions.length || context.settled?.has(item.id)) return null;
  const question = questions[Math.min(page, questions.length - 1)];
  const at = Math.min(page, questions.length - 1);
  const hasOptions = question.options.length > 0;
  const choice = choices[at];
  const custom = !hasOptions || choice?.kind === "other";
  const answerAt = (index) => {
    const picked = choices[index];
    if (questions[index].options.length && picked?.kind === "option") return picked.label;
    return texts[index] ?? "";
  };
  const answers = questions.map((_, index) => answerAt(index));
  const text = asyncAnswerText(questions, answers);
  const last = at === questions.length - 1;
  const unavailable = busy || !context.canAnswer;
  const submit = async () => {
    if (!last) { setPage(at + 1); return; }
    if (!text || unavailable) return;
    setBusy(true);
    setError("");
    try { await context.answer(item.id, text); }
    catch (e) { setError(e?.message || t("Your answer couldn’t be sent. Try again.")); }
    finally { setBusy(false); }
  };
  return (
    <section className="source-async-questions sq-card" role="group" aria-labelledby={questionId} data-async-questions={item.id}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.repeat) { event.preventDefault(); void submit(); }
      }}>
      <header className="sq-header">
        <div id={questionId} className="sq-question">{question.title}</div>
        {questions.length > 1 && (
          <span className="sq-progress">
            <button type="button" className="sq-nav" data-size="sm" aria-label={t("Show previous question")} disabled={busy || at === 0} onClick={() => setPage(at - 1)}>
              <Icon name="CaretLeft" size={12} />
            </button>
            <span aria-live="polite">{t("{current} of {total}", { current: at + 1, total: questions.length })}</span>
            <button type="button" className="sq-nav" data-size="sm" aria-label={t("Show next question")} disabled={busy || last} onClick={() => setPage(at + 1)}>
              <Icon name="CaretRight" size={12} />
            </button>
          </span>
        )}
      </header>
      <div className="sq-options">
        {question.options.map((option, index) => {
          const checked = choice?.kind === "option" && choice.label === option;
          return (
            <button key={`${index}:${option}`} type="button" className="sq-option" aria-pressed={checked} disabled={unavailable}
              onClick={() => setChoices((all) => ({ ...all, [at]: checked ? undefined : { kind: "option", label: option } }))}>
              <RadioMark checked={checked} />
              <span className="sq-option-copy"><span>{option}</span></span>
            </button>
          );
        })}
        <div className={`sq-option sq-custom ${hasOptions ? "" : "sq-freeform"}`}>
          {hasOptions && (
            <>
              <button type="button" className="sq-custom-select" aria-label={t("Other")} aria-pressed={custom} disabled={unavailable}
                onClick={() => setChoices((all) => ({ ...all, [at]: { kind: "other" } }))} />
              <span className="sq-custom-label" aria-hidden="true"><RadioMark checked={custom} /><span>{t("Other")}</span></span>
            </>
          )}
          <textarea className="sq-custom-control" rows={1} value={texts[at] ?? ""} disabled={unavailable} tabIndex={custom ? 0 : -1}
            aria-label={hasOptions ? t("Other option") : question.title} placeholder={hasOptions ? t("Type your own answer here") : t("Write your answer")}
            autoComplete="off" spellCheck
            onFocus={() => { if (hasOptions && !custom) setChoices((all) => ({ ...all, [at]: { kind: "other" } })); }}
            onChange={(event) => { const value = event.target.value; setTexts((all) => ({ ...all, [at]: value })); }} />
        </div>
      </div>
      {error && <p className="sq-error" role="alert">{error}</p>}
      <footer className="sq-actions">
        <button type="button" className="sq-skip" data-variant="secondary" disabled={busy} onClick={() => context.skip(item.id)}>{t("Skip")}</button>
        <button type="button" className="sq-submit" aria-busy={busy || undefined} disabled={unavailable || (last && !text)} onClick={() => void submit()}>
          <span className="sq-submit-label">{last ? t("Send answer") : t("Next")}</span>
        </button>
      </footer>
    </section>
  );
}
