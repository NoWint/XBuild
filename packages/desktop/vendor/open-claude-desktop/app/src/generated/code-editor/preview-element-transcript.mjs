// Original selected-element transcript card, disclosure and size-change animation.
import {
  useRef as D,
  useCallback as N,
  useLayoutEffect as C,
  useState as g,
} from "react";
import { jsx as k, jsxs as P } from "react/jsx-runtime";
export function createSelectedElementTranscript({
  useIntl: Q,
  Message: Z,
  Icon: Ws,
  Collapsible: xs,
  Details: vce,
  Image: ImageComponent,
}) {
  const I = (...parts) => parts.filter(Boolean).join(" "),
    Zr = (node) => node?.ownerDocument?.defaultView ?? null;
  const jme = () => {},
    mp = () => undefined,
    Wg = ({ children }) => children,
    hc = { Image: ImageComponent };
  const S_e = () => {
    throw new Error(
      "Simulator cards are not supported by the browser element host",
    );
  };
  const WD = "data-transcript-click-acts";
  const Of = WD;
  function UM(e, t) {
    let n = { left: e.left - t.left, right: t.right - e.right };
    return Math.abs(n.left + n.right) < 1 ? null : n;
  }
  function WM(e, t, n, r, i) {
    let a = e.left * (1 - t),
      o = e.right * (1 - t),
      s = (e) => (e >= 1 ? `${e}px` : i);
    return {
      clipPath: `inset(${i} ${s(o)} ${i} ${s(a)} round ${r})`,
      slide: n ? -Math.max(o, 0) : Math.max(a, 0),
    };
  }
  function GM(e) {
    let t = D(null),
      n = D(null),
      r = D(null),
      i = D(null),
      a = D([]),
      o = D({ from: 0, to: 1 }),
      s = N(() => {
        for (let e of a.current) e.cancel();
        a.current = [];
      }, []),
      c = N(
        (e) => {
          ((n.current = e), e === null && o.current.to === 0 && s());
        },
        [s],
      ),
      l = N(() => {
        n.current === null &&
          (r.current = t.current?.getBoundingClientRect() ?? null);
      }, []);
    return (
      C(() => {
        let c = t.current,
          l = r.current,
          u = Zr(c);
        if (
          !c ||
          !n.current ||
          !l ||
          !u ||
          (a.current.length > 0 && o.current.to === +!!e)
        )
          return;
        let d = c.getBoundingClientRect();
        if (!e && i.current === null) {
          let e = UM(l, d);
          e !== null && (i.current = Math.abs(e.right) < Math.abs(e.left));
        }
        let f = l.right - l.left,
          p = e
            ? l
            : (i.current ?? !0)
              ? { left: d.right - f, right: d.right }
              : { left: d.left, right: d.left + f };
        r.current = p;
        let m = UM(p, d);
        e && m !== null && (i.current = Math.abs(m.right) < Math.abs(m.left));
        let {
            transitionProperty: h,
            transitionDuration: g,
            transitionTimingFunction: _,
          } = u.getComputedStyle(n.current),
          v = u.getComputedStyle(c),
          { direction: y, borderTopLeftRadius: b } = v,
          x = `${-((parseFloat(v.getPropertyValue("--cds-ring-outer")) || 1) + 1)}px`,
          S = a.current[0]?.effect?.getComputedTiming().progress ?? null,
          { from: C, to: w } = o.current,
          T = S === null ? +!e : C + (w - C) * S,
          E = parseFloat(g) * 1e3 * (e ? 1 - T : T);
        if ((s(), m === null || h === "none" || !(E > 0))) return;
        let D = y === "rtl",
          O = WM(m, T, D, b, x),
          k = WM(m, +!!e, D, b, x),
          A = O.slide === k.slide ? [] : Array.from(c.children),
          j = { duration: E, easing: _, fill: e ? "none" : "forwards" };
        o.current = { from: T, to: +!!e };
        try {
          a.current = [
            c.animate({ clipPath: [O.clipPath, k.clipPath] }, j),
            ...A.map((e) =>
              e.animate(
                {
                  transform: [
                    `translateX(${O.slide}px)`,
                    `translateX(${k.slide}px)`,
                  ],
                },
                j,
              ),
            ),
          ];
        } catch {}
      }, [e, s]),
      { cardRef: t, panelRef: c, beforeToggle: l }
    );
  }
  const KM = new Set(["element"]);
  function qM(e, t, n) {
    if (e === void 0) return null;
    let {
      src: r,
      fullSrc: i,
      fileName: a,
      path: o,
      width: s,
      height: c,
      onOpen: l,
      registerThumbnail: u,
    } = e;
    return k(Wg, {
      src: i ?? r,
      fileName: a,
      path: o,
      reveal: "checked",
      children: k(hc.Image, {
        ref: u,
        className: "self-start",
        src: r,
        srcSet: t,
        width: s,
        height: c,
        alt: n,
        onClick: l,
      }),
    });
  }
  const JM =
    "button, a, [role=button], [data-cds=MessageAttachmentsImage], [data-card-panel]";
  function YM({ view: e, screenshot: t, className: n }) {
    let r = Q(),
      i = mp(t?.src),
      [a, o] = g(!1),
      { cardRef: s, panelRef: c, beforeToggle: l } = GM(a),
      u = (e) => {
        (e && !a && jme(), l(), o(e));
      };
    if (e.overflow !== void 0)
      return P("div", {
        "data-find-omitted": "",
        className: I(
          "flex w-fit max-w-full min-w-0 items-center gap-1 rounded-lg bg-alpha-1 p-sm text-caption text-secondary shadow-card-ring select-text",
          n,
        ),
        children: [
          k(Ws, { name: "Cursor", size: "sm", className: "shrink-0" }),
          k("span", {
            children: r.formatMessage(
              {
                defaultMessage:
                  "{n, plural, one {# more selected element was sent to Claude, not shown here} other {# more selected elements were sent to Claude, not shown here}}",
                id: "OnI29rCYpz",
              },
              { n: e.overflow },
            ),
          }),
        ],
      });
    let d = e.sections.find((e) => e.id === "raw"),
      f = d?.kind === "code" ? d.cut : void 0,
      p = qM(
        t,
        i,
        r.formatMessage({
          defaultMessage: "Screenshot of the selected element",
          id: "b/youTcrTC",
        }),
      ),
      m = e.simulator ? S_e(e.simulator) : null,
      h = r.formatMessage({ defaultMessage: "Element", id: "SHkKGmzgh6" }),
      _ = e.partial
        ? f
          ? r.formatMessage(
              {
                defaultMessage:
                  "These rows do not show everything that was sent. The \u201CExact text sent\u201D row, in the details below, has the rest except {n, plural, one {# character} other {# characters}}.",
                id: "usA7/7giEi",
              },
              { n: f.omitted },
            )
          : d
            ? r.formatMessage({
                defaultMessage:
                  "These rows do not show everything that was sent. The \u201CExact text sent\u201D row, in the details below, has the rest.",
                id: "kVRzXhy4zq",
              })
            : r.formatMessage({
                defaultMessage:
                  "These rows do not show everything that was sent.",
                id: "6qM2RTmAlW",
              })
        : null;
    return P("div", {
      ref: s,
      "data-find-omitted": "",
      [Of]: "",
      className: I(
        "flex w-fit max-w-full min-w-0 cursor-interactive flex-col gap-1 rounded-lg bg-alpha-1 p-sm shadow-card-ring transition-colors duration-fast select-text hover:bg-alpha-2 motion-reduce:transition-none",
        n,
      ),
      onClick: (e) => {
        let t = e.target;
        e.currentTarget.contains(t) &&
          t.closest(JM) === null &&
          Zr(t)?.getSelection()?.isCollapsed !== !1 &&
          u(!a);
      },
      children: [
        p,
        P(xs.Root, {
          open: a,
          onOpenChange: u,
          className: "flex flex-col gap-sm",
          children: [
            P(xs.Trigger, {
              caretPosition: "end",
              className: "max-w-full",
              children: [
                k(Ws, { name: "Cursor", size: "sm", className: "shrink-0" }),
                k("span", {
                  className: "min-w-0 truncate text-primary",
                  children:
                    m === null
                      ? e.title
                      : m.name === null
                        ? k("span", {
                            className: "text-secondary",
                            children: m.type ?? h,
                          })
                        : P("span", {
                            className: "flex gap-1",
                            children: [
                              k("span", {
                                className: "min-w-0 truncate",
                                children: m.name,
                              }),
                              k("span", {
                                className:
                                  "max-w-[calc(100%-0.25rem)] shrink-0 truncate text-secondary",
                                children: m.type ?? h,
                              }),
                            ],
                          }),
                }),
              ],
            }),
            e.note !== void 0 &&
              P("div", {
                className: "flex flex-col gap-0.5",
                children: [
                  k("span", {
                    className: "text-caption text-muted",
                    children: k(Z, {
                      defaultMessage: "Your note",
                      id: "P/5KcHjP2w",
                    }),
                  }),
                  k("span", {
                    className:
                      "text-primary whitespace-pre-wrap [overflow-wrap:anywhere]",
                    children: e.note,
                  }),
                ],
              }),
            k(xs.Panel, {
              ref: c,
              children: P("div", {
                "data-card-panel": "",
                className: "flex cursor-auto flex-col gap-sm",
                children: [
                  _ !== null &&
                    k("div", {
                      className: "text-caption text-muted",
                      children: _,
                    }),
                  k(vce, { view: e, omit: KM }),
                ],
              }),
            }),
          ],
        }),
      ],
    });
  }
  return YM;
}
