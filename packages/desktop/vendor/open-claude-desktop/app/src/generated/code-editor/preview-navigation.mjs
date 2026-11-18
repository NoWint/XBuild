// Original current Preview navigation row and header geometry.
import { Fragment as a, memo as c, useMemo as l } from "react";
import { jsx as i, jsxs as s } from "react/jsx-runtime";
export function createPreviewNavigation({ Button: C, Tooltip: x }) {
  const b = a,
    j = ({ children }) => children;
  const M = (() => {
    const r = "flex min-w-0 shrink-0 items-center h-9 gap-2 border-b px-1";
    function i(e, t = r) {
      return { className: t };
    }
    return i;
  })();
  const P = {
    navigation: "Navigation",
    pageTools: "Page tools",
    back: "Back",
    forward: "Forward",
    reload: "Reload",
    annotate: "Annotate",
    selectElement: "Select element",
    exitSelection: "Exit selection mode",
  };
  const F = "hidden @[320px]:inline-flex";
  const ie = c(function ({
    canGoBack: e,
    canGoForward: t,
    canReload: n,
    onBack: r,
    onForward: a,
    onReload: o,
    shortcuts: c,
    children: u,
    annotate: d,
    selectElement: f,
    labels: p,
    inline: m = !1,
    followsPaneHeader: h = !1,
  }) {
    let g = l(() => ({ ...P, ...p }), [p]),
      { className: _, ...v } = M(h && !m),
      y = f?.pressed ? (f.pressedLabel ?? g.exitSelection) : g.selectElement;
    return i(b, {
      children: s("div", {
        ...v,
        className: `@container draggable-none ${m ? "flex min-w-0 flex-1 items-center gap-2" : _}`,
        children: [
          s("div", {
            role: "group",
            "aria-label": g.navigation,
            className: "flex shrink-0 items-center gap-0.5",
            children: [
              i(I, {
                on: !m,
                content: g.back,
                shortcut: c?.back,
                hoverable: !1,
                side: "top",
                children: i(C, {
                  variant: "ghost",
                  iconOnly: !0,
                  icon: "ArrowLeft",
                  "aria-label": g.back,
                  tooltip: !m,
                  disabled: !e,
                  onClick: r,
                }),
              }),
              i(I, {
                on: !m,
                content: g.forward,
                shortcut: c?.forward,
                hoverable: !1,
                side: "top",
                children: i(C, {
                  variant: "ghost",
                  iconOnly: !0,
                  icon: "ArrowRight",
                  "aria-label": g.forward,
                  tooltip: !m,
                  disabled: !t,
                  onClick: a,
                  className: F,
                }),
              }),
              i(I, {
                on: !m,
                content: g.reload,
                shortcut: c?.reload,
                hoverable: !1,
                side: "top",
                children: i(C, {
                  variant: "ghost",
                  iconOnly: !0,
                  icon: "ArrowClockwise",
                  "aria-label": g.reload,
                  tooltip: !m,
                  disabled: !n,
                  onClick: o,
                }),
              }),
            ],
          }),
          i(j, { value: !m, children: u }),
          (d || f) &&
            s("div", {
              role: "group",
              "aria-label": g.pageTools,
              className: "flex shrink-0 items-center gap-0.5",
              children: [
                d &&
                  i(C, {
                    variant: "ghost",
                    iconOnly: !0,
                    icon: "Edit",
                    "aria-label": g.annotate,
                    tooltip: !m,
                    tooltipSide: "top",
                    shortcut: d.shortcut,
                    pressed: d.pressed,
                    disabled: d.disabled,
                    onClick: d.onToggle,
                    className: d.pressed ? void 0 : F,
                  }),
                f &&
                  i(I, {
                    on: !m,
                    content: y,
                    detail: f.pressed ? void 0 : g.selectElementDetail,
                    shortcut: f.shortcut,
                    hoverable: !1,
                    side: "top",
                    children: i(C, {
                      variant: "ghost",
                      iconOnly: !0,
                      icon: "Cursor",
                      "aria-label": y,
                      tooltip: !m,
                      shortcut: f.shortcut,
                      pressed: f.pressed,
                      disabled: f.disabled,
                      onClick: f.onToggle,
                      className: f.pressed ? void 0 : F,
                    }),
                  }),
              ],
            }),
        ],
      }),
    });
  });
  function I({ on: e, children: t, ...n }) {
    return e ? i(x, { ...n, children: t }) : i(a, { children: t });
  }
  return ie;
}
