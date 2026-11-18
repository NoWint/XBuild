// Original pane menu trigger, sections and rows. Host supplies local CDS/portal primitives.
import {
  useState as e,
  useEffect as t,
  useRef as n,
  Fragment as i,
  memo as c,
} from "react";
import { jsx as r, jsxs as s } from "react/jsx-runtime";
export function createPreviewPaneMenu({
  Menu: v,
  Button: _,
  Tooltip: g,
  Provider: a,
  useIntl: b,
  usePortal: y,
  collisionPadding: u,
  isTextInput: f,
  asElement: m,
  useOwnerWindow: h,
}) {
  function F(e) {
    f(e.target) || e.preventDefault();
  }
  const I = [];
  const U = c(function ({
    sections: e,
    onOpenChange: t,
    disabled: n,
    paneName: i,
    unroll: a = !0,
    triggerRef: o,
    className: c,
  }) {
    let l = b(),
      d = y(),
      f = e ?? I;
    if (f.every((e) => e.items.length === 0)) return null;
    let p = a ? Z(f) : null;
    if (p)
      return r(_, {
        ref: o,
        variant: "ghost",
        iconOnly: !0,
        icon: p.icon,
        "aria-label": p.ariaLabel,
        onClick: p.onSelect,
        disabled: n || p.disabled,
        className: c,
      });
    let m = l.formatMessage(
      { defaultMessage: "{pane} settings", id: "0v5PlsRKXz" },
      { pane: i },
    );
    return s(v.Root, {
      onOpenChange: t,
      children: [
        r(g, {
          content: m,
          children: r(v.Trigger, {
            disabled: n,
            render: r(_, {
              ref: o,
              variant: "ghost",
              iconOnly: !0,
              icon: "DotsVertical",
              "aria-label": m,
              tooltip: !1,
              className: c,
            }),
          }),
        }),
        r(v.Popup, {
          onContextMenu: F,
          side: "bottom",
          align: "end",
          container: d,
          collisionPadding: u,
          children: r(W, { sections: f, portalContainer: d }),
        }),
      ],
    });
  });
  function W({ sections: e, portalContainer: t }) {
    let n = e
      .filter((e) => e.items.length > 0)
      .map((e, n) =>
        s(
          i,
          {
            children: [
              n > 0 && !e.noSeparator && r(v.Separator, {}),
              s(v.Group, {
                children: [
                  e.header && r(v.GroupLabel, { children: e.header }),
                  e.items.map((e, n) =>
                    r(X, { item: e, portalContainer: t }, e.value ?? n),
                  ),
                ],
              }),
            ],
          },
          e.key ?? n,
        ),
      );
    return r(a, { children: n });
  }
  const G = 10.5;
  function K(e, t) {
    return (e.items ?? []).filter(
      (e) =>
        t === "" ||
        (typeof e.label == "string" && e.label.toLowerCase().includes(t)),
    );
  }
  function q(e) {
    return m(
      e?.activeElement
        ?.closest('[role="menu"]')
        ?.querySelector(
          '[role^="menuitem"][data-highlighted]:not([aria-disabled="true"]):not([aria-haspopup])',
        ),
    );
  }
  function J({ item: t, searchLabel: n, portalContainer: i }) {
    let a = h(),
      [o, s] = e(""),
      c = K(t, o.trim().toLowerCase()).find(
        (e) => e.items === void 0 && !e.disabled && e.onSelect,
      )?.onSelect;
    return r(v.SearchablePopup, {
      searchLabel: n,
      query: o,
      onQueryChange: (e) => {
        (s(e), t.onSearchQueryChange?.(e));
      },
      onSubmitQuery:
        c === void 0 || t.searchPending === !0
          ? void 0
          : () => {
              let e = q(a?.document);
              e === null ? c() : e.click();
            },
      container: i,
      collisionPadding: u,
      maxVisibleItems: G,
      children: (e) => r(Y, { item: t, query: e, portalContainer: i }),
    });
  }
  function Y({ item: e, query: t, portalContainer: n }) {
    let i = K(e, t);
    return i.length > 0
      ? r(v.Group, {
          children: i.map((e, t) =>
            r(X, { item: e, portalContainer: n }, e.value ?? t),
          ),
        })
      : r("div", {
          role: "presentation",
          className: "px-md py-sm text-footnote text-muted",
          children: e.searchEmptyLabel,
        });
  }
  function X({ item: e, portalContainer: t }) {
    let n = e.disabled === !0 && !!e.disabledReason;
    if (e.items && !n)
      return s(a, {
        children: [
          e.separatorBefore && r(v.Separator, {}),
          s(v.Submenu, {
            disabled: e.disabled,
            onOpenChange: e.onOpenChange,
            children: [
              r(v.SubmenuTrigger, {
                trailing: e.trailing,
                hint: e.hint,
                openOnHover:
                  e.trailing !== void 0 || e.hint !== void 0 ? !1 : void 0,
                children: e.label,
              }),
              e.searchLabel === void 0
                ? r(v.Popup, {
                    container: t,
                    collisionPadding: u,
                    children: e.items.map((e, n) =>
                      r(X, { item: e, portalContainer: t }, e.value ?? n),
                    ),
                  })
                : r(J, {
                    item: e,
                    searchLabel: e.searchLabel,
                    portalContainer: t,
                  }),
            ],
          }),
        ],
      });
    let i = r(v.Item, {
      leading: e.leading,
      trailing: e.trailing,
      shortcut: e.shortcut,
      description: e.description,
      descriptionLines: e.descriptionLines,
      hint: e.hint,
      disabled: e.disabled,
      disabledReason: e.disabledReason,
      variant: e.variant,
      checked: e.checked,
      checkedRole: e.checkedRole,
      keepOpen: e.keepOpen,
      onClick: e.onSelect,
      children: e.label,
    });
    return s(a, {
      children: [
        e.separatorBefore && r(v.Separator, {}),
        e.tooltip
          ? r(g, {
              content: e.tooltip,
              side: e.tooltipSide,
              children: r("span", {
                className: "flex [&>*]:w-full",
                children: i,
              }),
            })
          : i,
      ],
    });
  }
  function Z(e) {
    let t = e.flatMap((e) => e.items);
    if (t.length !== 1) return null;
    let n = t[0];
    return n.icon === void 0 ||
      n.onSelect === void 0 ||
      n.items !== void 0 ||
      n.checked !== void 0 ||
      n.leading !== void 0 ||
      n.trailing !== void 0 ||
      n.tooltip !== void 0 ||
      n.disabledReason !== void 0 ||
      n.hint !== void 0 ||
      n.description !== void 0 ||
      n.shortcut !== void 0 ||
      n.variant === "danger" ||
      typeof n.label != "string"
      ? null
      : { ...n, icon: n.icon, ariaLabel: n.label };
  }
  return { Menu: U, Sections: W };
}
