// Original server-menu item rendering, tooltips, loading and trailing actions.
import { useEffect as e, Fragment as n } from "react";
import { jsx as t, jsxs as r } from "react/jsx-runtime";
export function createPreviewMenuItems({
  Menu: s,
  Tooltip: a,
  Spinner: o,
  collisionPadding: i,
}) {
  function d(e) {
    let t = e.description ?? void 0,
      n = e.disabled ? e.tooltip : void 0;
    return n
      ? { description: t ? `${t} \u00B7 ${n}` : n, descriptionLines: void 0 }
      : { description: t, descriptionLines: e.descriptionLines };
  }
  function f(e, n) {
    return !e.tooltip || e.disabled
      ? n
      : t(a, {
          content: e.tooltip,
          side: e.tooltipSide ?? "right",
          multiline: e.tooltipMultiline ?? !0,
          onOpenChange: e.onTooltipOpenChange,
          children: n,
        });
  }
  function p(e) {
    return (
      e &&
      t("span", {
        className: "contents",
        onClick: (e) => e.stopPropagation(),
        children: e,
      })
    );
  }
  function m({ onShown: t }) {
    return (
      e(() => {
        t();
      }, [t]),
      null
    );
  }
  function h(e, a, c) {
    return function l(u, h) {
      let g = u.value ?? h;
      if (u.items)
        return r(
          n,
          {
            children: [
              u.separatorBefore && t(s.Separator, {}),
              r(s.Submenu, {
                disabled: u.disabled,
                onOpenChange: u.onOpenChange,
                children: [
                  t(s.SubmenuTrigger, {
                    icon: u.icon,
                    openOnHover: u.pressSelects ? !0 : void 0,
                    onClick:
                      u.pressSelects && u.onSelect
                        ? (e) => {
                            (e.preventDefault(),
                              e.stopPropagation(),
                              e.preventBaseUIHandler?.(),
                              u.onSelect?.(),
                              c
                                ? c()
                                : e.currentTarget.dispatchEvent(
                                    new KeyboardEvent("keydown", {
                                      key: "Escape",
                                      bubbles: !0,
                                    }),
                                  ));
                          }
                        : void 0,
                    trailing:
                      u.trailing ??
                      (u.hint === void 0
                        ? void 0
                        : t("span", {
                            className: "text-footnote text-muted",
                            children: u.hint,
                          })),
                    children:
                      u.pressSelects && u.description
                        ? r("span", {
                            className: "flex min-w-0 flex-1 flex-col",
                            children: [
                              t("span", {
                                className: "truncate",
                                children: u.label,
                              }),
                              t("span", {
                                className:
                                  "truncate py-[0.125em] -my-[0.125em] text-footnote text-muted",
                                children: u.description,
                              }),
                            ],
                          })
                        : u.label,
                  }),
                  t(s.Popup, {
                    className: "epitaxy-root break-words",
                    container: e,
                    collisionPadding: i,
                    children: u.items.map(l),
                  }),
                ],
              }),
            ],
          },
          g,
        );
      let _ =
          u.checked !== void 0 && u.trailing && u.checkedRole === "checkbox",
        v = r(s.Item, {
          icon: u.loading ? void 0 : u.icon,
          leading: u.loading
            ? r("span", {
                role: "status",
                className: "flex",
                children: [
                  t(o, { size: "sm" }),
                  t("span", {
                    className: "sr-only",
                    children: a.formatMessage({
                      defaultMessage: "Loading",
                      id: "iFsDVRnIHW",
                    }),
                  }),
                ],
              })
            : u.leading,
          trailing: p(u.trailing),
          shortcut: u.shortcut,
          hint: u.hint,
          ...d(u),
          disabled: u.disabled,
          variant: u.variant,
          indicator: u.indicator,
          indeterminate: u.indeterminate,
          href: u.href,
          routerOptions: u.routerOptions,
          target: u.target,
          checked: _ ? void 0 : u.checked,
          checkedRole:
            _ || u.checked === void 0 ? void 0 : (u.checkedRole ?? "radio"),
          ...(_ && { role: "menuitemcheckbox", "aria-checked": u.checked }),
          keepOpen: u.keepOpen,
          onClick: u.onSelect,
          onPointerDown: u.onPointerDown,
          onPointerEnter: u.onPointerEnter,
          onPointerLeave: u.onPointerLeave,
          onFocus: u.onFocus,
          onBlur: u.onBlur,
          onKeyDown: u.trailingAction
            ? (e) => {
                e.key === "ArrowRight" &&
                  !e.defaultPrevented &&
                  (e.preventDefault(),
                  e.stopPropagation(),
                  u.trailingAction?.());
              }
            : void 0,
          children: [
            u.label,
            u.trailingAction &&
              t("span", {
                className: "sr-only",
                children: `, ${u.trailingActionAriaHint ?? a.formatMessage({ defaultMessage: "press right arrow to activate", id: "Vu8t3l8URu" })}`,
              }),
          ],
        });
      return r(
        n,
        {
          children: [
            u.separatorBefore && t(s.Separator, {}),
            u.onShown && t(m, { onShown: u.onShown }),
            f(u, v),
          ],
        },
        g,
      );
    };
  }
  return h;
}
