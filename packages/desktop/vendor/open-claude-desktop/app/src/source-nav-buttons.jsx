import React from "react";
import { ToolButton } from "./code-ui";
import { t } from "../electron/i18n/index.mjs";
import "./source-nav-buttons.css";
// sidebar-session.js:10732-10800 qM: two ghost icon-only CDS Buttons (G),
// ArrowLeft "Back" / ArrowRight "Forward", tooltipSide bottom, shortcut
// "cmd+[" / "cmd+]" on mac (ka()), so the Button tooltip (shared-frame ks
// `q(es,{side:o,hoverable:!1,content,shortcut:c})`) shows the label plus the
// shortcut and aria-keyshortcuts is vo("cmd+[") = "Meta+[". Unavailable
// directions carry `aria-disabled: !f || void 0` and `onClick: f ? u : void 0`
// instead of native disabled, so they stay focusable; KM gives them
// pointer-events none and 50% children. The source reads canGoBack/canGoForward
// from webContents navigationHistory (Vt); locally the same flags come from
// main.jsx history/historyAt (travel()).
export const NAV_TOOLTIPS = {
  back: { content: t("Back"), shortcut: "cmd+[", side: "bottom", hoverable: false },
  forward: { content: t("Forward"), shortcut: "cmd+]", side: "bottom", hoverable: false },
};
export function navAvailability(historyAt = 0, historyLength = 1) {
  return { canGoBack: historyAt > 0, canGoForward: historyAt < historyLength - 1 };
}
// placement "sidebar": wrapper "flex items-center draggable-none"; elsewhere
// "flex items-center gap-0.5 draggable-none" (qM className).
export function SourceNavButtons({ placement, historyAt = 0, historyLength = 1, travel }) {
  const { canGoBack, canGoForward } = navAvailability(historyAt, historyLength);
  return (
    <div className="source-nav-buttons" data-placement={placement}>
      <ToolButton label={t("Back")} icon="ArrowLeft" tooltip={NAV_TOOLTIPS.back} aria-keyshortcuts="Meta+["
        aria-disabled={!canGoBack || undefined} onClick={canGoBack ? () => travel?.(-1) : undefined} />
      <ToolButton label={t("Forward")} icon="ArrowRight" tooltip={NAV_TOOLTIPS.forward} aria-keyshortcuts="Meta+]"
        aria-disabled={!canGoForward || undefined} onClick={canGoForward ? () => travel?.(1) : undefined} />
    </div>
  );
}
