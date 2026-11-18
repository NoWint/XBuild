// Pure behavior extracted from the original editor wrapper. No account/desktop hooks.
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
const y = () =>
  typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
const b = { cursor: { interactive: { cssVar: "pointer" } } };
var jt = 1e4,
  Mt = 2,
  Nt = 8,
  Pt = /^[ \t]*/;
function Ft(e) {
  let t = 0,
    n = 0,
    r = new Map(),
    i = 0,
    a = 0;
  for (let o of e) {
    if (((a += 1), a > jt)) break;
    let e = Pt.exec(o)?.[0] ?? "";
    if (e.length !== o.length) {
      if (e.startsWith("	")) t += 1;
      else if (!e.includes("	")) {
        let t = e.length;
        n += +(t >= Mt);
        let a = t - i;
        (a >= Mt && a <= Nt && i % a === 0 && r.set(a, (r.get(a) ?? 0) + 1),
          (i = t));
      }
    }
  }
  if (t > n) return "	";
  let o = 0,
    s = 0;
  for (let [e, t] of r) (t > s || (t === s && e < o)) && ((o = e), (s = t));
  for (let e = Mt; e < o; e += 1)
    if (o % e === 0 && (r.get(e) ?? 0) * 2 >= s) return " ".repeat(e);
  return o === 0 ? null : " ".repeat(o);
}
var It = { "(": ")", "[": "]", "{": "}" },
  Lt = { ")": "(", "]": "[", "}": "{" },
  Rt = 200,
  zt = new Set(["haskell"]);
function Bt(e, t) {
  let n = e.facet(ht);
  if (n === null) return !0;
  if (!(n instanceof Oe) || zt.has(n.name) || !Je(e, t)) return !1;
  let r = new Ze(e, { simulateBreak: t });
  return I(r, t) === null;
}
function Vt(e, t) {
  return /string|comment/i.test(Xe(e).resolveInner(t, -1).name);
}
function Ht(e, t) {
  let n = Math.max(e.doc.lineAt(t).from, t - Rt),
    r = /([([{])\s*$/.exec(e.sliceDoc(n, t));
  return r?.[1] !== void 0 && !Vt(e, n + r.index + 1) ? r[1] : null;
}
function Ut(e) {
  return /^\s*/.exec(e)?.[0] ?? "";
}
var Wt = ({ state: e, dispatch: t }) => {
    let { ranges: n } = e.selection,
      r = new Set(n.map((t) => e.doc.lineAt(t.from).from));
    if (
      e.readOnly ||
      r.size < n.length ||
      !n.some((t) => Ht(e, t.from) !== null) ||
      !n.every((t) => Bt(e, t.from))
    )
      return !1;
    let i = e.changeByRange((t) => {
      let n = e.doc.lineAt(t.from),
        r = n.text.slice(0, t.from - n.from),
        i = Ht(e, t.from),
        a = ze(Ut(n.text), e.tabSize),
        { from: o, to: s } = t;
      for (; s < n.to && /\s/.test(n.text[s - n.from] ?? ""); ) s++;
      let c = ["", He(e, i ? a + lt(e) : a)];
      return (
        i && t.empty && e.sliceDoc(s, s + 1) === It[i]
          ? ((o = n.from + r.trimEnd().length), c.push(He(e, a)))
          : r.length < Rt && !/\S/.test(r) && (o = n.from),
        {
          changes: { from: o, to: s, insert: Fe.of(c) },
          range: H.cursor(o + 1 + (c[1]?.length ?? 0)),
        }
      );
    });
    return (t(e.update(i, { scrollIntoView: !0, userEvent: "input" })), !0);
  },
  Gt = N.transactionFilter.of((e) => {
    if (
      !e.docChanged ||
      !(e.isUserEvent("input.type") || e.isUserEvent("input.complete"))
    )
      return e;
    let t = e.newSelection.ranges.flatMap(({ head: t }) => {
      let n = e.newDoc.lineAt(t),
        r =
          t <= n.from + Rt &&
          /^(\s*)([)\]}])$/.exec(e.newDoc.sliceString(n.from, t));
      return r ? [{ head: t, line: n, indent: r[1], close: r[2] }] : [];
    });
    if (t.length === 0) return e;
    let { state: n } = e,
      r = [],
      i = -1;
    for (let { head: e, line: a, indent: o = "", close: s = "" } of t) {
      if (a.from === i || Vt(n, e) || !Bt(n, e)) continue;
      i = a.from;
      let t = P(n, e, -1, { brackets: `${Lt[s]}${s}` });
      if (!t?.matched || !t.end) continue;
      let c = Ut(n.doc.lineAt(t.end.from).text);
      c !== o && r.push({ from: a.from, to: a.from + o.length, insert: c });
    }
    return r.length > 0 ? [e, { changes: r, sequential: !0 }] : e;
  });
function Kt(e) {
  return e ? [z.high(j.of([{ key: "Enter", run: Wt, shift: Wt }])), Gt] : [];
}
var qt = at.filter((e) => e.run !== Le);
function Jt(e, t) {
  return (
    P(e, t, -1) ??
    (t > 0 ? P(e, t - 1, 1) : null) ??
    P(e, t, 1) ??
    (t < e.doc.length ? P(e, t + 1, -1) : null)
  );
}
function Yt(e, t) {
  let { head: n } = t,
    r = t.empty ? Jt(e, n) : null;
  if (!r?.end) return t;
  let { start: i, end: a } = r,
    o = i.from === n ? a.from : a.to,
    s = Jt(e, o)?.start.from === a.from;
  return H.cursor(s ? o : a.to);
}
var Xt = (e) => {
    let { state: t } = e,
      n = H.create(
        t.selection.ranges.map((e) => Yt(t, e)),
        t.selection.mainIndex,
      );
    return (
      !n.eq(t.selection) &&
      (e.dispatch({ selection: n, scrollIntoView: !0, userEvent: "select" }),
      !0)
    );
  },
  Zt = new Set(["\\", "|"]);
function Qt(e) {
  return e.code !== "Backslash" && !Zt.has(e.key)
    ? !1
    : y()
      ? e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey
      : e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey;
}
var $t = O.domEventHandlers({
  keydown: (e, t) => (Qt(e) ? (e.repeat || Xt(t), !0) : !1),
});
function en(e) {
  return e ? $t : j.of([{ key: "Shift-Mod-\\", run: Le }]);
}
var tn = ({ state: e, dispatch: t }) => {
    if (e.readOnly) return !1;
    if (e.selection.ranges.some((e) => !e.empty))
      return Ue({ state: e, dispatch: t });
    let n = e.facet(Qe),
      r = -1,
      i = "",
      a = 0;
    return (
      t(
        e.update(
          e.changeByRange(({ head: t }) => {
            let o = e.doc.lineAt(t);
            o.from !== r && ((r = o.from), (i = o.text), (a = 0));
            let s = t - o.from + a,
              c = ze(i, e.tabSize, s),
              l = n.startsWith("	") ? n : " ".repeat(n.length - (c % n.length));
            return (
              (i = i.slice(0, s) + l + i.slice(s)),
              (a += l.length),
              { changes: { from: t, insert: l }, range: H.cursor(t + l.length) }
            );
          }),
          { scrollIntoView: !0, userEvent: "input" },
        ),
      ),
      !0
    );
  },
  nn = (e) => {
    let { state: t } = e,
      { head: n } = t.selection.main,
      r = t.sliceDoc(n, n + 1),
      i = r === "" ? null : je(t, r);
    return i !== null && i.newDoc.length === t.doc.length && Ee(e);
  };

function mn(e) {
  return {
    "folded code": e.formatMessage({
      defaultMessage: "Folded code",
      id: "y14PC0y+Tc",
    }),
    unfold: e.formatMessage({ defaultMessage: "Unfold", id: "wEd4QzDM3W" }),
    "Folded lines": e.formatMessage({
      defaultMessage: "Folded lines",
      id: "u6NxI3onIq",
    }),
    "Unfolded lines": e.formatMessage({
      defaultMessage: "Unfolded lines",
      id: "sIkDlKpeNm",
    }),
    to: e.formatMessage({ defaultMessage: "to", id: "oSGXQ1hbXT" }),
  };
}
var hn = "http://www.w3.org/2000/svg";
function gn() {
  let e = document.createElementNS(hn, "svg");
  for (let [t, n] of Object.entries({
    viewBox: "0 0 16 16",
    width: "12",
    height: "12",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  }))
    e.setAttribute(t, n);
  for (let t of ft.master16)
    if ("d" in t) {
      let n = document.createElementNS(hn, "path");
      (n.setAttribute("d", t.d), e.appendChild(n));
    }
  return e;
}
var _n = O.theme({
  ".cm-gutters .cm-lineNumbers .cm-gutterElement": {
    minWidth: "2rem",
    paddingRight: "0",
  },
  ".cm-foldGutter .cm-gutterElement": {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "0",
  },
  ".cm-foldGutter span": {
    display: "flex",
    alignItems: "center",
    height: "1lh",
    padding: "0",
    cursor: b.cursor.interactive.cssVar,
  },
  ".cm-foldGutter .cm-fold-open svg": { transform: "rotate(90deg)" },
  ".cm-foldPlaceholder": { cursor: b.cursor.interactive.cssVar },
});
function vn(e) {
  let t = e.facet(ht);
  return t !== null && !(t instanceof Oe);
}
var yn = new Set(["[", "{"]),
  bn = new Set(["]", "}"]);
function xn(e) {
  return (
    y()
      ? e.metaKey && e.altKey && !e.ctrlKey && !e.shiftKey
      : e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey
  )
    ? e.code === "BracketLeft" || yn.has(e.key)
      ? De
      : e.code === "BracketRight" || bn.has(e.key)
        ? Ie
        : null
    : null;
}
var Sn = O.domEventHandlers({
  keydown: (e, t) => {
    let n = xn(e);
    return n !== null && (n(t) || vn(t.state));
  },
});
function Cn(e, t) {
  if (!e) return [];
  let n = t.formatMessage({ defaultMessage: "Fold line", id: "QuJCxXn7V+" }),
    r = t.formatMessage({ defaultMessage: "Unfold line", id: "rxq1Bsa/SF" });
  return [
    N.phrases.of(mn(t)),
    E({
      markerDOM: (e) => {
        let t = document.createElement("span");
        return (
          (t.className = e ? "cm-fold-open" : "cm-fold-closed"),
          (t.title = e ? n : r),
          t.appendChild(gn()),
          t
        );
      },
      domEventHandlers: {
        mousedown: (e, t, n) =>
          "button" in n && n.button !== 0 ? !1 : (e.focus(), !0),
      },
    }),
    _n,
    Sn,
  ];
}

var W = -1,
  Un = 1e3,
  Wn = 100,
  Gn = { number: 0, columns: W };
function Kn(e, t) {
  let n = 0,
    r = Math.min(e.length, Un);
  for (let i = 0; i < r; i++) {
    let r = e.charCodeAt(i);
    if (r === 32) n++;
    else if (r === 9) n += t - (n % t);
    else return n;
  }
  return W;
}
function qn(e, t, n, r) {
  let i = t;
  for (let a = 1; a <= Wn; a++) {
    let o = t + n * a;
    if (o < 1 || o > e.lines) break;
    i = o;
    let s = Kn(e.line(o).text, r);
    if (s !== W) return { number: i, columns: s };
  }
  return { number: i, columns: W };
}
function Jn(e, t, n, r, i) {
  let a = [],
    o = qn(e, t, -1, r),
    s = null;
  for (let c = t; c <= n; c++) {
    let t = Kn(e.line(c).text, r);
    if (t !== W) {
      ((o = { number: c, columns: t }), (s = null), a.push(Math.ceil(t / i)));
      continue;
    }
    ((s ??= o.columns === W ? Gn : qn(e, o.number, 1, r)),
      s.columns === W
        ? a.push(0)
        : o.columns === s.columns
          ? a.push(Math.ceil(o.columns / i))
          : a.push(1 + Math.floor(Math.min(o.columns, s.columns) / i)));
  }
  return a;
}
function Yn(e) {
  let { doc: t, tabSize: n } = e.state,
    r = lt(e.state),
    i = new et(),
    a = new Map();
  for (let { from: o, to: s } of e.visibleRanges) {
    let e = t.lineAt(o).number,
      c = Jn(t, e, t.lineAt(s).number, n, r);
    for (let [n, o] of c.entries()) {
      if (o === 0) continue;
      let s = a.get(o);
      s ||
        ((s = D.line({
          class: "cm-epitaxyIndentGuides",
          attributes: {
            style: `--epitaxy-indent-unit:${r}ch;--epitaxy-indent-guides-width:${(o - 1) * r + 1}ch`,
          },
        })),
        a.set(o, s));
      let { from: c } = t.line(e + n);
      i.add(c, c, s);
    }
  }
  return i.finish();
}
var Xn = T.fromClass(
    class {
      constructor(e) {
        this.decorations = Yn(e);
      }
      update(e) {
        (e.docChanged ||
          e.viewportChanged ||
          e.startState.tabSize !== e.state.tabSize ||
          lt(e.startState) !== lt(e.state)) &&
          (this.decorations = Yn(e.view));
      }
    },
    { decorations: (e) => e.decorations },
  ),
  Zn = O.baseTheme({
    ".cm-epitaxyIndentGuides": {
      backgroundImage:
        "repeating-linear-gradient(to right, var(--epitaxy-indent-guide, color-mix(in srgb, currentColor 14%, transparent)) 0 1px, transparent 1px var(--epitaxy-indent-unit))",
      backgroundSize: "var(--epitaxy-indent-guides-width) 100%",
      backgroundRepeat: "no-repeat",
      backgroundOrigin: "content-box",
    },
    "@supports (height: 1lh)": {
      ".cm-epitaxyIndentGuides": {
        backgroundSize: "var(--epitaxy-indent-guides-width) 1lh",
      },
    },
  });
function Qn() {
  return [Xn, Zn];
}

var Ki = D.line({ class: "cm-activeLine" }),
  qi = T.fromClass(
    class {
      constructor(e) {
        this.decorations = this.build(e);
      }
      update(e) {
        (e.docChanged || e.selectionSet) &&
          (this.decorations = this.build(e.view));
      }
      build(e) {
        let { ranges: t } = e.state.selection;
        if (t.some((e) => !e.empty)) return D.none;
        let n = -1,
          r = [];
        for (let i of t) {
          let t = e.lineBlockAt(i.head);
          t.from > n && (r.push(Ki.range(t.from)), (n = t.from));
        }
        return D.set(r);
      }
    },
    { decorations: (e) => e.decorations },
  ),
  Ji = Ve.define();

var Zi = Ve.define();
var Qi = "  ";
function $i(e) {
  return Ft(e.iterLines()) ?? Qi;
}
var ea = qe.define({
  create: (e) => $i(e.doc),
  update: (e, t) => (t.annotation(Zi) ? $i(t.newDoc) : e),
  provide: (e) => Qe.from(e),
});
function ta(e) {
  return e ? ea : Qe.of(Qi);
}
var ra = N.transactionFilter.of((e) => {
  let { selection: t } = e;
  if (
    !t ||
    t.ranges.length < 2 ||
    e.docChanged ||
    !e.isUserEvent("select.pointer")
  )
    return e;
  let n = V(e.startState),
    r = t.ranges.filter((t) => {
      let r = e.startState.doc.lineAt(t.from);
      if (t.to > r.to) return !0;
      let i = !1;
      return (
        n.between(r.from, r.to, (e, n) => {
          let a = e < r.from && n >= r.to;
          i ||= a || (e < t.to && n > t.from);
        }),
        !i
      );
    });
  return r.length === 0 || r.length === t.ranges.length
    ? e
    : [e, { selection: H.create(r, Math.max(0, r.indexOf(t.main))) }];
});
function ia(e) {
  return e ? [Ge(), ra] : [];
}
function aa(e, t) {
  return e
    ? [
        j.of([{ key: "Tab", run: tn, shift: mt }]),
        z.high(j.of([{ key: "Ctrl-m", mac: "Shift-Alt-m", run: M }])),
        O.contentAttributes.of({ "aria-describedby": t }),
      ]
    : [];
}
function oa(e) {
  return e ? [Ne(), z.high(j.of([{ key: "Backspace", run: nn }]))] : [];
}

var Si = 32,
  Ci = 1e6,
  Q = new Map();
function wi(e, t, n) {
  if (e === null) return;
  Q.delete(e);
  let r = t.state.sliceDoc();
  if (
    !(r.length > Ci || (n.unappliedScroll === void 0 && !n.atLine && Ti(t))) &&
    (Q.set(e, {
      doc: r,
      selection: t.state.selection,
      history: t.state.field(Be, !1),
      folds: t.state.field(S, !1),
      scroll: n.unappliedScroll ?? t.scrollSnapshot(),
    }),
    Q.size > Si)
  ) {
    let e = Q.keys().next();
    e.done || Q.delete(e.value);
  }
}
function Ti(e) {
  let { selection: t } = e.state;
  return (
    bt(e.state) === 0 &&
    Ye(e.state) === 0 &&
    (e.state.field(S, !1)?.size ?? 0) === 0 &&
    t.ranges.length === 1 &&
    t.main.empty &&
    t.main.head === 0 &&
    e.scrollDOM.scrollTop === 0 &&
    e.scrollDOM.scrollLeft === 0
  );
}
function Ei(e, t) {
  if (e === null) return;
  let n = Q.get(e);
  return (Q.delete(e), n !== void 0 && n.doc === t ? n : void 0);
}
function Di(e) {
  let t = e?.history;
  return t === void 0 ? [] : Be.init(() => t);
}

function kn(e, t) {
  return e && t !== void 0 ? S.init(() => t) : [];
}
export {
  Ft as detectIndentation,
  ta as detectedIndentation,
  Zi as resetIndentation,
  Kt as bracketIndentation,
  en as bracketJump,
  qt as editorKeymap,
  oa as autoCloseBrackets,
  aa as tabIndentation,
  ia as columnSelection,
  Cn as codeFolding,
  Qn as indentGuides,
  tn as insertTabIndent,
  Wt as bracketEnter,
  Xt as jumpBracket,
};
export {
  wi as rememberEditorView,
  Ei as restoreEditorView,
  Di as restoredHistory,
  kn as restoredFolds,
};
export const baseLanguageBehavior = [dt(), k(), qi, B(), nt()];
