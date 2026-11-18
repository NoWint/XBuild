// Original link destination chooser and input arming delay.
import { useId as t, useState as n, memo as a } from "react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
import { useState as armState, useEffect as armEffect } from "react";
const g = (() => {
  const e = armState,
    t = armEffect;
  function n(n, r) {
    let [i, a] = e(!1),
      [o, s] = e(0),
      [c, l] = e({ active: n, key: r });
    return (
      (c.active !== n || c.key !== r) &&
        (l({ active: n, key: r }), n && (a(!1), s((e) => e + 1))),
      t(() => {
        if (!n || i) return;
        let e = setTimeout(() => a(!0), 500);
        return () => clearTimeout(e);
      }, [n, i, o]),
      !n || i
    );
  }
  return n;
})();
export function createPreviewLinkChooser({
  RadioGroup: o,
  useShortcut: s,
  Icon: c,
  ConfirmationDialog: l,
  platform: u,
  useIntl: d,
  useChooserSeen: f,
  useLinksPreference: p,
  useModalPresence: m,
  useBrowserLabel: h,
}) {
  const v = a(
    ({
      isOpen: e,
      onClose: a,
      onConfirmed: _,
      protectInput: v = !1,
      armKey: y,
      opensPullRequest: b = !1,
    }) => {
      let x = d(),
        S = h(),
        C = t(),
        [w] = s("cmd", u()),
        [T, E] = p(),
        [D, O] = n(T),
        [, k] = f(),
        [A, j] = n(b);
      e && A !== b && j(b);
      let M = A
        ? x.formatMessage({
            defaultMessage:
              "Opens this pull request beside the chat. Other links open there too, where Claude can see and act on the page.",
            id: "bqUpk9ln95",
          })
        : x.formatMessage({
            defaultMessage:
              "Opens beside the chat. Claude can see and act on the page.",
            id: "aDHcSu+fob",
          });
      m(e);
      let N = g(e && v, y),
        [P, F] = n({ isOpen: e, pref: T });
      return (
        (P.isOpen !== e || P.pref !== T) &&
          (F({ isOpen: e, pref: T }), e && O(T)),
        r(l, {
          initialFocus: "cancel",
          className: "epitaxy-root break-words",
          open: e,
          onOpenChange: (e) => {
            e || a();
          },
          onConfirm: () => {
            (E(D), k(!0), _?.(), a());
          },
          disabled: v && !N,
          title: x.formatMessage({
            defaultMessage: "Where should links open?",
            id: "SW2I2RenJ7",
          }),
          description: x.formatMessage({
            defaultMessage: "Choose what happens when you click a link.",
            id: "ducm9DLEvN",
          }),
          confirmLabel: x.formatMessage({
            defaultMessage: "Done",
            id: "JXdbo8Vnlw",
          }),
          children: i("div", {
            className: "flex flex-col gap-2.5 pt-md",
            children: [
              i(o.Root, {
                "aria-label": x.formatMessage({
                  defaultMessage: "Link destination",
                  id: "NENRc4Q2v1",
                }),
                "aria-describedby": C,
                value: D ? "preview" : "browser",
                onValueChange: (e) => O(e === "preview"),
                children: [
                  r(o.Card, {
                    value: "preview",
                    leading: r(c, { name: "Globe" }),
                    label: x.formatMessage({
                      defaultMessage: "Open in app",
                      id: "8XhRcNMyE2",
                    }),
                    description: M,
                  }),
                  r(o.Card, {
                    value: "browser",
                    leading: r(c, { name: "ArrowOutSquare" }),
                    label: S,
                    description: x.formatMessage({
                      defaultMessage:
                        "Opens outside the app, in your default browser.",
                      id: "hKY7t+mrIz",
                    }),
                  }),
                ],
              }),
              r("p", {
                id: C,
                "aria-live": "polite",
                className: "text-caption text-muted",
                children: D
                  ? x.formatMessage(
                      {
                        defaultMessage:
                          "{modifier}-click a link to open it in your default browser.",
                        id: "oqpJZ5fC7z",
                      },
                      { modifier: w },
                    )
                  : null,
              }),
            ],
          }),
        })
      );
    },
  );
  return v;
}
