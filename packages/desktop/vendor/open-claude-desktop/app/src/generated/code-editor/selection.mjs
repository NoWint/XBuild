// Original selection tooltip, line-gutter drag and inline comment widgets.
import {
  $ as S,
  A as Te,
  Bt as C,
  E as Ee,
  F as w,
  It as T,
  J as E,
  K as De,
  L as Oe,
  Lt as ke,
  Mt as Ae,
  Nt as D,
  O as je,
  Pt as O,
  Qt as Me,
  R as k,
  S as Ne,
  St as A,
  Yt as Pe,
  Zt as j,
  _ as M,
  _n as Fe,
  _t as Ie,
  a as Le,
  an as Re,
  bn as ze,
  c as Be,
  cn as Ve,
  ct as He,
  d as Ue,
  dn as N,
  dt as We,
  en as Ge,
  ft as P,
  g as Ke,
  gn as qe,
  gt as Je,
  h as Ye,
  hn as F,
  ht as Xe,
  it as I,
  j as Ze,
  l as L,
  ln as R,
  lt as Qe,
  m as $e,
  mn as et,
  mt as tt,
  n as nt,
  nn as rt,
  nt as it,
  o as at,
  on as ot,
  p as st,
  pn as z,
  qt as B,
  rn as ct,
  rt as lt,
  s as ut,
  st as dt,
  t as ft,
  tn as pt,
  tt as V,
  u as mt,
  un as H,
  ut as ht,
  v as gt,
  vn as _t,
  vt,
  xn as yt,
  y as bt,
} from "./c148e7537-Ks6hIVju.js";
const _ = (node) => node.ownerDocument.defaultView,
  ee = _;
const Ji = Ve.define();
function hi(e, t) {
  let n = e.doc.lineAt(t.to);
  return !t.empty && t.to === n.from ? n.number - 1 : n.number;
}
function gi(e) {
  let { ranges: t, mainIndex: n } = e.selection,
    r = [],
    i = 0;
  return (
    t.forEach((a, o) => {
      ((o === 0 || e.doc.lineAt(a.from).number > hi(e, t[o - 1]) + 1) &&
        r.push([]),
        o === n && (i = r.length - 1),
        a.empty || r[r.length - 1].push(a));
    }),
    r[i].length > 0 ? r[i] : (r.find((e) => e.length > 0) ?? [])
  );
}
function _i(e) {
  let t = gi(e),
    n = t.map((t) => {
      let n = bi(e.sliceDoc(t.from, t.to));
      return n.endsWith(`
`)
        ? n.slice(0, -1)
        : n;
    }).join(`
`);
  return n.trim() === ""
    ? null
    : {
        text: n,
        range: {
          fromLine: e.doc.lineAt(t[0].from).number,
          toLine: hi(e, t[t.length - 1]),
        },
      };
}
function vi(e) {
  let { main: t, ranges: n } = e.selection,
    r = gi(e);
  if (n.length > 1 && r.length > 0)
    return { pos: r[r.length - 1].to, above: !1, far: r[0].from };
  let i = (n) => (n > t.from && n === e.doc.lineAt(n).from ? n - 1 : n);
  return t.head <= t.anchor
    ? { pos: t.head, above: !0, far: i(t.anchor) }
    : { pos: i(t.head), above: !1, far: t.anchor };
}
function yi({ head: e, far: t, space: n, chipHeight: r, above: i }) {
  let a = e ?? {
    left: n.left,
    right: n.left,
    top: n.bottom + 1,
    bottom: n.bottom + 1,
  };
  if (a.top >= n.bottom || a.bottom <= n.top) return a;
  let o = i ? a.top - r >= n.top : a.bottom + r <= n.bottom,
    s = i,
    c = a;
  if (!o) {
    if (t === null || !(i ? t.bottom + r <= n.bottom : t.top - r >= n.top))
      return a;
    ((s = !i), (c = t));
  }
  let { left: l, right: u } = a;
  return s
    ? { left: l, right: u, top: c.top, bottom: n.bottom }
    : { left: l, right: u, top: n.top, bottom: c.bottom };
}
function bi(e) {
  return e.replace(
    /\r\n?|[\u2028\u2029]/g,
    `
`,
  );
}

function Dn(e, t) {
  let n = t,
    r = V(e).iter(n);
  for (; r.value !== null && r.from <= n; )
    ((n = Math.max(n, e.doc.lineAt(r.to).to)), r.next());
  return n;
}
function On(e, t) {
  let n = t,
    r = !0;
  for (; r; ) {
    let t = n;
    (V(e).between(t, t, (r) => {
      r < t && (n = Math.min(n, e.doc.lineAt(r).from));
    }),
      (r = n < t));
  }
  return n;
}
function kn(e, t) {
  return e && t !== void 0 ? S.init(() => t) : [];
}
function An(e, t, n) {
  let { doc: r } = e,
    i = (e) => Math.max(1, Math.min(e, r.lines)),
    a = r.line(i(t)),
    o = r.line(i(n)),
    s = (t) => On(e, t.from),
    c = (t) => Math.min(Dn(e, t.to) + 1, r.length);
  return o.number >= a.number ? H.single(s(a), c(o)) : H.single(c(a), s(o));
}
function jn(e) {
  let { anchor: t, head: n } = e.selection.main,
    r = e.doc.lineAt(t),
    i = t > n && t === r.from && r.number > 1 ? e.doc.line(r.number - 1) : r;
  return e.doc.lineAt(On(e, i.from)).number;
}
var Mn = 50,
  Nn = 6;
function Pn(e) {
  return Math.max(0, e) * 0.7 + 8;
}
var Fn = ["pointerup", "pointercancel", "lostpointercapture"];
function In(e) {
  return "pointerId" in e && "button" in e;
}
var Ln = T.fromClass(
  class {
    constructor() {
      this.stop = null;
    }
    destroy() {
      this.stop?.();
    }
  },
);
function Rn(e, t) {
  let n = e.lineBlockAtHeight(t - e.documentTop);
  return e.state.doc.lineAt(n.from).number;
}
function zn(e, t, n) {
  if (!In(n) || n.button !== 0 || n.pointerType === "touch") return;
  let r = e.plugin(Ln);
  if (!r) return;
  let i = n.clientY - e.documentTop,
    a = e.lineBlockAtHeight(i);
  if (i > a.bottom) return;
  r.stop?.();
  let o = e.state.doc.lineAt(a.from).number,
    s = n.shiftKey ? jn(e.state) : o,
    c = o,
    l = (t) => {
      e.dispatch({ selection: An(e.state, s, t), userEvent: "select.pointer" });
    };
  (e.focus(), l(c));
  let u = e.dom,
    { pointerId: d } = n;
  u.setPointerCapture(d);
  let f = ee(u),
    p = n.clientY,
    m = 0,
    h,
    g = () => {
      let t = Rn(e, p);
      t !== c && ((c = t), l(t));
    },
    _ = () => {
      let { top: t, bottom: n } = e.scrollDOM.getBoundingClientRect();
      ((m = p <= t + Nn ? -Pn(t - p) : p >= n - Nn ? Pn(p - n) : 0),
        m !== 0 && h === void 0
          ? (h = f.setInterval(() => {
              ((e.scrollDOM.scrollTop += m), g());
            }, Mn))
          : m === 0 && h !== void 0 && (f.clearInterval(h), (h = void 0)));
    },
    v = () => {
      u.removeEventListener("pointermove", y);
      for (let e of Fn) u.removeEventListener(e, te);
      (h !== void 0 && (f.clearInterval(h), (h = void 0)),
        r.stop === v && (r.stop = null));
    },
    y = (e) => {
      e.pointerId === d && ((p = e.clientY), g(), _());
    },
    te = (e) => {
      e.pointerId === d && v();
    };
  u.addEventListener("pointermove", y);
  for (let e of Fn) u.addEventListener(e, te);
  r.stop = v;
}
function Bn(e) {
  return !!e.plugin(Ln)?.stop;
}
var Vn = O.baseTheme({
  ".cm-lineNumbers .cm-gutterElement": {
    cursor: "default",
    userSelect: "none",
  },
});
function Hn() {
  return [
    Ln,
    Vn,
    Me({
      domEventHandlers: {
        pointerdown: (e, t, n) => (zn(e, t, n), !1),
        mousedown: Bn,
      },
    }),
  ];
}

var ya = F.define(),
  ba = F.define(),
  xa = 250,
  Sa = O.theme({
    ".cm-tooltip.cm-epitaxyAttachChip": {
      backgroundColor: "transparent",
      border: "none",
      paddingBottom: "8px",
      pointerEvents: "none",
    },
    ".cm-tooltip-below.cm-epitaxyAttachChip": {
      paddingBottom: "0",
      paddingTop: "8px",
    },
  }),
  Ca = (e) => e.closest("[data-pane-root]"),
  wa = (e) => {
    let t = e.scrollDOM.getBoundingClientRect(),
      n = Ca(e.dom)?.getBoundingClientRect();
    return {
      top: t.top,
      bottom: t.bottom,
      left: n?.left ?? t.left,
      right: t.right,
    };
  };
function Ta(e) {
  let t = (t, n) => {
      if (t.state.field(a).dismissed) return !1;
      let r = e.getHandler(),
        i = _i(t.state);
      return !r || !i
        ? !1
        : (r(i.text, i.range, n), t.dispatch({ effects: ba.of(null) }), !0);
    },
    n = (e) => {
      let t = e.doc.lineAt(e.selection.main.head).number;
      return _i(e)?.range ?? { fromLine: t, toLine: t };
    },
    r = (t) => {
      let r = e.getCommentHandler();
      if (!r) return;
      let { doc: i, selection: a } = t.state,
        { fromLine: o, toLine: s } = n(t.state);
      (r(
        o,
        s,
        bi(
          i.sliceString(
            i.line(o).from,
            i.line(s).to,
            `
`,
          ),
        ),
      ),
        a.ranges.some((e) => !e.empty) &&
          t.dispatch({ selection: { anchor: a.main.head } }));
    },
    i = (n) => {
      let i = _i(n);
      if ((!e.getHandler() && !e.getCommentHandler()) || i === null)
        return null;
      let { range: a } = i,
        { pos: o, above: s, far: c } = vi(n);
      return {
        pos: o,
        above: s,
        strictSide: !1,
        create: (n) => {
          let i = n.dom.ownerDocument.createElement("div");
          i.className = "cm-epitaxyAttachChip";
          let o = {
            dom: i,
            attach: () => t(n, "chip"),
            comment: () => r(n),
            range: a,
          };
          return {
            dom: i,
            getCoords: (e) =>
              yi({
                head: n.coordsAtPos(e),
                far: n.coordsAtPos(c, s ? -1 : 1),
                space: wa(n),
                chipHeight: i.getBoundingClientRect().height,
                above: s,
              }),
            mount: () => e.onChipLifecycle("mount", o),
            destroy: () => e.onChipLifecycle("unmount", o),
          };
        },
      };
    },
    a = qe.define({
      create: () => ({ settled: !1, dismissed: !1, tooltip: null }),
      update(e, t) {
        let { settled: n, dismissed: r } = e;
        for (let e of t.effects) e.is(ya) ? (n = !0) : e.is(ba) && (r = !0);
        return (
          (t.selection || t.docChanged) &&
            ((n = !1), t.selection && !t.annotation(Ji) && (r = !1)),
          n === e.settled && r === e.dismissed
            ? e
            : { settled: n, dismissed: r, tooltip: n && !r ? i(t.state) : null }
        );
      },
      provide: (e) => Re.from(e, (e) => e.tooltip),
    });
  return {
    extension: [
      a,
      T.fromClass(
        class {
          constructor(e) {
            ((this.timer = null), (this.view = e));
          }
          update(e) {
            (!e.selectionSet && !e.docChanged) ||
              (this.timer !== null &&
                (clearTimeout(this.timer), (this.timer = null)),
              !e.state.selection.ranges.every((e) => e.empty) &&
                (this.timer = setTimeout(() => {
                  ((this.timer = null),
                    this.view.dispatch({ effects: ya.of(null) }));
                }, xa)));
          }
          destroy() {
            this.timer !== null && clearTimeout(this.timer);
          }
        },
      ),
      j.of([{ key: "Mod-Shift-l", run: (e) => t(e, "keybinding") }]),
      Sa,
      ot({ parent: e.tooltipParent, tooltipSpace: wa }),
    ],
    attach: t,
    comment: r,
    commentLines: n,
    attachable: (t) =>
      e.getHandler() && !t.field(a).dismissed ? (_i(t)?.range ?? null) : null,
  };
}
var Ea = 0,
  Da = new WeakMap(),
  Oa = new WeakMap(),
  ka = F.define(),
  Aa = F.define(),
  ja = 64,
  Ma = class extends ke {
    constructor(e, t, n) {
      (super(), (this.id = e), (this.height = t), (this.lifecycle = n));
    }
    eq(e) {
      return e.id === this.id && e.height === this.height;
    }
    updateDOM(e, t, n) {
      return n.id === this.id;
    }
    get estimatedHeight() {
      return this.height ?? ja;
    }
    toDOM(e) {
      let t = e.dom.ownerDocument.createElement("div");
      ((t.className = "cm-epitaxyCommentCard"), (Ea += 1));
      let n = { id: this.id, dom: t, seq: Ea };
      Da.set(t, n);
      let r = _(e.dom)?.ResizeObserver;
      if (r) {
        let { id: i } = this,
          a = new r(() => {
            let r = t.getBoundingClientRect().height;
            r !== n.reportedHeight &&
              ((n.reportedHeight = r),
              e.dispatch({
                effects: Aa.of({ id: i, height: r }),
                annotations: _t.addToHistory.of(!1),
              }));
          });
        (a.observe(t), Oa.set(t, a));
      }
      return (this.lifecycle("mount", n), t);
    }
    destroy(e) {
      Oa.get(e)?.disconnect();
      let t = Da.get(e);
      t && this.lifecycle("unmount", t);
    }
  },
  Na = O.theme({
    ".cm-epitaxyCommentCard": {
      cursor: "default",
      position: "sticky",
      left: "var(--epitaxy-cm-text-left, 0px)",
      maxWidth: "var(--epitaxy-cm-text-width, 100%)",
    },
  }),
  Pa = T.fromClass(
    class {
      constructor(e) {
        ((this.view = e), this.measure());
      }
      update(e) {
        e.geometryChanged && this.measure();
      }
      measure() {
        this.view.requestMeasure({
          key: this,
          read: (e) => ({
            left: e.contentDOM.offsetLeft,
            width: e.scrollDOM.clientWidth - e.contentDOM.offsetLeft,
          }),
          write: ({ left: e, width: t }, n) => {
            (n.dom.style.setProperty("--epitaxy-cm-text-left", `${e}px`),
              n.dom.style.setProperty("--epitaxy-cm-text-width", `${t}px`));
          },
        });
      }
    },
  );
function Fa(e) {
  return [
    qe.define({
      create: () => ({ slots: [], heights: new Map(), deco: D.none }),
      update(t, n) {
        let { slots: r, heights: i } = t;
        for (let e of n.effects)
          e.is(ka)
            ? (r = e.value)
            : e.is(Aa) &&
              i.get(e.value.id) !== e.value.height &&
              r.some((t) => t.id === e.value.id) &&
              (i = new Map(i).set(e.value.id, e.value.height));
        if (
          (r !== t.slots &&
            i.size > 0 &&
            (i = new Map([...i].filter(([e]) => r.some((t) => t.id === e)))),
          r === t.slots &&
            i === t.heights &&
            !n.docChanged &&
            n.state.field(S, !1) === n.startState.field(S, !1))
        )
          return t;
        if (r.length === 0) return { slots: r, heights: i, deco: D.none };
        let { doc: a } = n.state,
          o = r.map((t) =>
            D.widget({
              widget: new Ma(t.id, i.get(t.id) ?? null, e),
              block: !0,
              side: 1,
            }).range(
              Dn(n.state, a.line(Math.max(1, Math.min(t.line, a.lines))).to),
            ),
          );
        return { slots: r, heights: i, deco: D.set(o, !0) };
      },
      provide: (e) => O.decorations.from(e, (e) => e.deco),
    }),
    Na,
    Pa,
  ];
}
function Ia(e, t, n) {
  let r = n - e.documentTop;
  if (r < 0 || r > e.lineBlockAt(e.state.doc.length).bottom) return null;
  let i = e.lineBlockAtHeight(r),
    a = i;
  if (Array.isArray(i.type)) {
    let e = i.type.find((e) => e.type === Ae.Text);
    if (!e) return null;
    a = e;
  }
  return r < a.top || r > a.bottom
    ? null
    : {
        line: e.state.doc.lineAt(i.from).number,
        top: a.top + e.documentTop - t,
        rowHeight: Math.min(a.height, e.defaultLineHeight),
      };
}

var Ua = Ve.define();
var Ga = D.line({ class: "cm-epitaxyJumpRange" });
function qa(e, t) {
  return qe.define({
    create: () => ({ range: null, hidden: !1, deco: D.none }),
    update(n, r) {
      let { range: i } = n;
      for (let t of r.effects) t.is(e) && (i = t.value);
      t && r.docChanged && !r.annotation(Ua) && (i = null);
      let a = r.state.selection.ranges.some((e) => !e.empty);
      if (i === n.range && a === n.hidden && !r.docChanged) return n;
      if (i === null || a) return { range: i, hidden: a, deco: D.none };
      let o = Math.min(i.to, r.state.doc.lines),
        s = Math.max(1, Math.min(i.from, o)),
        c = [];
      for (let e = s; e <= o; e++) c.push(Ga.range(r.state.doc.line(e).from));
      return { range: i, hidden: a, deco: D.set(c) };
    },
    provide: (e) => O.decorations.from(e, (e) => e.deco),
  });
}
var Ya = F.define();
var Xa = qa(Ya, !1);
function Za(e) {
  return O.theme({
    ".cm-epitaxyJumpRange": {
      backgroundColor: e ?? "color-mix(in srgb, currentColor 8%, transparent)",
    },
  });
}
export {
  Xa as commentRangeHighlight,
  Ya as setCommentRange,
  Za as rangeHighlightTheme,
  Ta as selectionActions,
  Hn as selectableLineNumbers,
  Fa as commentWidgets,
  ka as setCommentSlots,
  Ia as hoveredEditorLine,
  An as lineRangeSelection,
  jn as lineSelectionAnchor,
  _i as selectedEditorContext,
  vi as selectionTooltipAnchor,
  yi as selectionTooltipCoords,
};
