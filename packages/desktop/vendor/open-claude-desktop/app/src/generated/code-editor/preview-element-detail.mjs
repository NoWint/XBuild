// Original browser-element detail components. Local host supplies CDS primitives and localization.
import {
  Fragment as L,
  useMemo as W,
  useState as _,
  useEffect as w,
} from "react";
import { jsx as F, jsxs as V } from "react/jsx-runtime";
import { selectedElementView as p_ } from "./preview-element-view.mjs";
export function createSelectedElementDetail({
  Icon: Ts,
  Message: Z,
  useIntl: Q,
  Collapsible: os,
}) {
  const te = (...parts) => parts.filter(Boolean).join(" ");
  // Browser contexts have no simulator row. Do not expose this factory for simulator data.
  const tb = () => {
    throw new Error(
      "Simulator detail rows are not supported by the browser element adapter",
    );
  };
  const O = (callback) => callback,
    Hh = () => {};
  const GD = new Set(["device"]);
  function KD(e, t) {
    switch (t) {
      case "element":
        return e.formatMessage({ defaultMessage: "Element", id: "SHkKGmzgh6" });
      case "attributes":
        return e.formatMessage({
          defaultMessage: "Attributes",
          id: "+xTpT1RJSk",
        });
      case "component":
        return e.formatMessage({
          defaultMessage: "Component",
          id: "S6QlZnIVfb",
        });
      case "props":
        return e.formatMessage({ defaultMessage: "Props", id: "f/wI6cXVyF" });
      case "source":
        return e.formatMessage({ defaultMessage: "Source", id: "aH4De2Y20k" });
      case "definedIn":
        return e.formatMessage({
          defaultMessage: "Defined in",
          id: "Q7EJjPSp3f",
        });
      case "renderedAt":
        return e.formatMessage({
          defaultMessage: "Rendered at",
          id: "qt6VZT6nY4",
        });
      case "text":
        return e.formatMessage({ defaultMessage: "Text", id: "aA8bDwsPeJ" });
      case "path":
        return e.formatMessage({
          defaultMessage: "Selector",
          id: "gxkld2Zqfg",
        });
      case "styles":
        return e.formatMessage({
          defaultMessage: "Computed styles",
          id: "lg05Fp37gX",
        });
      case "html":
        return e.formatMessage({ defaultMessage: "HTML", id: "g9J1FhQNeJ" });
      case "siblings":
        return e.formatMessage({
          defaultMessage: "Siblings",
          id: "9VV22LCe9k",
        });
      case "raw":
        return e.formatMessage({
          defaultMessage: "Exact text sent",
          id: "TxjzLRVHGi",
        });
    }
  }
  const qD = new Set([
    "element",
    "component",
    "props",
    "source",
    "definedIn",
    "renderedAt",
    "text",
  ]);
  function JD({ section: e, owners: t }) {
    switch (e.kind) {
      case "entries":
        return F("dl", {
          className:
            "grid grid-cols-[auto_minmax(0,1fr)] gap-x-sm gap-y-0.5 text-code",
          children: e.entries.map(([e, t]) =>
            V(
              "div",
              {
                className: "contents",
                children: [
                  F("dt", { className: "text-secondary", children: e }),
                  F("dd", {
                    className:
                      "min-w-0 text-primary whitespace-pre-wrap [overflow-wrap:anywhere]",
                    children: t,
                  }),
                ],
              },
              e,
            ),
          ),
        });
      case "code":
        return V("div", {
          className: "flex flex-col gap-xs",
          children: [
            F("pre", {
              className:
                "text-code text-primary bg-alpha-1 rounded-sm px-1.25 py-xs whitespace-pre-wrap [overflow-wrap:anywhere]",
              children: e.value,
            }),
            e.cut &&
              V(L, {
                children: [
                  F("div", {
                    className: "text-caption text-secondary",
                    children: F(Z, {
                      defaultMessage:
                        "{n, plural, one {# character} other {# characters}} not shown here",
                      id: "dtY0tL/Dvb",
                      values: { n: e.cut.omitted },
                    }),
                  }),
                  F("pre", {
                    className:
                      "text-code text-primary bg-alpha-1 rounded-sm px-1.25 py-xs whitespace-pre-wrap [overflow-wrap:anywhere]",
                    children: e.cut.tail,
                  }),
                ],
              }),
          ],
        });
      case "text":
        return e.id === "component"
          ? V("span", {
              className: "min-w-0 [overflow-wrap:anywhere]",
              children: [
                F("code", {
                  className: "text-code text-primary",
                  children: e.value,
                }),
                t.length > 0 &&
                  V("span", {
                    className: "text-secondary",
                    children: [
                      " ",
                      F(Z, {
                        defaultMessage: "in {owners}",
                        id: "3exxNrWVG9",
                        values: { owners: t.join(" \u203A ") },
                      }),
                    ],
                  }),
              ],
            })
          : e.id === "source" || e.id === "definedIn" || e.id === "renderedAt"
            ? F("code", {
                className: "text-code text-primary [overflow-wrap:anywhere]",
                children: e.value,
              })
            : F("span", {
                className:
                  "text-primary whitespace-pre-wrap [overflow-wrap:anywhere]",
                children: e.value,
              });
    }
  }
  function YD({ sections: e, owners: t }) {
    let n = Q();
    return F("dl", {
      className:
        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-md gap-y-1 text-body",
      children: e.map((e) =>
        V(
          "div",
          {
            className: "contents",
            children: [
              F("dt", { className: "text-muted", children: KD(n, e.id) }),
              F("dd", {
                className: "min-w-0",
                children: F(JD, { section: e, owners: t }),
              }),
            ],
          },
          e.id,
        ),
      ),
    });
  }
  function XD({ rows: e }) {
    return F("dl", {
      className:
        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-md gap-y-1 text-body",
      children: e.map((e) =>
        V(
          "div",
          {
            className: "contents",
            children: [
              F("dt", {
                className: te("text-muted", e.code && "font-mono-ui"),
                children: e.label,
              }),
              F("dd", {
                className:
                  "min-w-0 text-primary whitespace-pre-wrap [overflow-wrap:anywhere]",
                children: e.value,
              }),
            ],
          },
          e.key,
        ),
      ),
    });
  }
  function ZD({ open: e, exactTextOnly: t, count: n }) {
    return t
      ? e
        ? F(Z, { defaultMessage: "Hide exact text sent", id: "BiYRV9it55" })
        : F(Z, { defaultMessage: "Show exact text sent", id: "eIgor2SyNt" })
      : e
        ? F(Z, { defaultMessage: "Hide details", id: "X5Q310+ucD" })
        : F(Z, {
            defaultMessage:
              "Show {count, plural, one {# more detail} other {# more details}}",
            id: "zmi5t2SGo3",
            values: { count: n },
          });
  }
  function QD({ view: e, omit: t }) {
    let n = Q(),
      r = e.component?.owners ?? [],
      i = e.simulator ? tb(e.simulator, n, GD) : [],
      a = t ? e.sections.filter((e) => !t.has(e.id)) : e.sections,
      o = a.filter((e) => qD.has(e.id)),
      s = a.filter((e) => !qD.has(e.id)),
      [c, l] = _(!1);
    return V("div", {
      className: "flex flex-col gap-sm min-w-0",
      children: [
        i.length > 0 && F(XD, { rows: i }),
        o.length > 0 && F(YD, { sections: o, owners: r }),
        s.length > 0 &&
          V(os.Root, {
            open: c,
            onOpenChange: l,
            children: [
              F(os.Trigger, {
                children: F(ZD, {
                  open: c,
                  exactTextOnly:
                    e.simulator !== void 0 && s.every((e) => e.id === "raw"),
                  count: s.length,
                }),
              }),
              F(os.Panel, {
                children: F("div", {
                  className: "pt-sm",
                  children: F(YD, { sections: s, owners: r }),
                }),
              }),
            ],
          }),
      ],
    });
  }
  function pO(e) {
    return e ? `data:image/png;base64,${e}` : null;
  }
  function mO(e) {
    return e === "click" || e === "keyboard" || e === "menu";
  }
  function hO({ ctx: e, width: t, scrollRegionLabel: n, openedVia: r }) {
    let i = Q(),
      a = W(() => p_(e), [e]),
      o = pO(e.screenshot),
      s = O(() => {
        Hh(r);
      }),
      c = mO(r);
    return (
      w(() => {
        s();
      }, [c]),
      V("div", {
        tabIndex: n === void 0 ? void 0 : 0,
        role: n === void 0 ? void 0 : "group",
        "aria-label": n,
        className:
          "flex flex-col gap-sm max-w-full min-w-0 max-h-[360px] overflow-y-auto p-md text-body select-text text-left rounded-[inherit] focus-visible:outline-hidden hide-focus-ring focus-visible:shadow-focus",
        style: t === void 0 ? void 0 : { width: t },
        children: [
          V("div", {
            className: "flex items-center gap-1 text-secondary",
            children: [
              F(Ts, { name: "Cursor", size: "sm" }),
              F("span", {
                className: "min-w-0 flex-1 truncate",
                children: F(Z, {
                  defaultMessage: "Included with your message",
                  id: "/kf//7IggN",
                }),
              }),
            ],
          }),
          o !== null &&
            F("img", {
              src: o,
              alt: i.formatMessage({
                defaultMessage: "Screenshot of the selected element",
                id: "b/youTcrTC",
              }),
              className:
                "block max-h-[120px] max-w-full self-start rounded-sm shadow-card-ring",
            }),
          a.unsafeDisplay &&
            V("div", {
              role: "status",
              "data-testid": "element-context-unsafe-notice",
              className: "flex items-start gap-1 text-caption text-danger",
              children: [
                F(Ts, {
                  name: "WarningCircle",
                  size: "xs",
                  className: "mt-[2px] shrink-0",
                  "aria-hidden": !0,
                }),
                F("span", {
                  children: F(Z, {
                    defaultMessage:
                      "This text contains hidden or direction-changing characters, so it may not read the way it is sent. Hidden characters are shown as codes.",
                    id: "/WQmF660Zr",
                  }),
                }),
              ],
            }),
          F(QD, { view: a }),
        ],
      })
    );
  }
  return { Preview: hO, Details: QD };
}
