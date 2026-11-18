import React from "react";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { SourceMarkdown } from "./source-session.jsx";
import { t } from "../electron/i18n/index.mjs";
import "./source-recap-card.css";

// rR (approval-current.js:20975-21022, the transcript tail's 'awayRecap' row :65060-65063): section role=status,
// overflow-clip rounded-[10px] border bg-surface-1 and a 1px/2px 3% shadow. Header (border-b px-3 py-1.5): h3 'Recap'
// in text-caption font-medium text-secondary and a ghost base icon-only X 'Dismiss recap' (-mr-1.5 text-secondary
// hover:bg-alpha-2). Body: p dir=auto break-words p-3 text-footnote italic text-secondary. The answer is the model's
// own text, so it renders as Markdown in that type, inside a bounded scroller; while it is written the body says so.
export function SourceRecapCard({ recap, sessionKey, onDismiss }) {
  if (!recap) return null;
  const loading = recap.status === "loading";
  return <section role="status" className="source-message src-recap" data-recap={loading ? "loading" : "done"}>
    <header className="src-recap-header">
      <h3 className="src-recap-title">{t("Recap")}</h3>
      {onDismiss && <SourceSettingsButton variant="ghost" icon="X" iconSize="auto" iconOnly aria-label={t("Dismiss recap")} className="src-recap-dismiss"
        onMouseDown={(event) => event.preventDefault()} onClick={onDismiss} />}
    </header>
    {loading || !recap.text
      ? <p dir="auto" className="src-recap-body">{t("Writing a recap…")}</p>
      : <div dir="auto" className="src-recap-body src-recap-markdown" tabIndex={0} role="group" aria-label={t("Recap")}>
        <SourceMarkdown text={recap.text} sessionKey={`recap-${sessionKey}`} itemId={`recap-${recap.at ?? 0}`} />
      </div>}
  </section>;
}
