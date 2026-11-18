// Original OT list renderer and Bp's newline presentation.
import { jsx as k, jsxs as P, Fragment as T } from "react/jsx-runtime";
const w = k,
  O = P;
const UR = "text-body whitespace-pre-wrap [overflow-wrap:anywhere] text-pretty";
function WR(e, t, n) {
  let r = e.items.map((e, n) =>
    P(
      "li",
      { children: [t(e.text), e.children.map((e, n) => WR(e, t, n))] },
      n,
    ),
  );
  return e.ordered
    ? k(
        "ol",
        {
          start: e.start === 1 ? void 0 : e.start,
          className: `epitaxy-user-list ${UR}`,
          children: r,
        },
        n,
      )
    : k("ul", { className: `epitaxy-user-list ${UR}`, children: r }, n);
}
function GR(e, t, n) {
  if (e.kind === "list") return WR(e.list, n, t);
  let r =
    e.text === "" ||
    e.text.endsWith(`
`)
      ? `${e.text}\n`
      : e.text;
  return k("p", { className: UR, children: n(r) }, t);
}
function hl(e, t = (e) => e) {
  let n = e.split(/\r\n?|\n/);
  return n.length === 1
    ? t(e)
    : n.map((e, n) => O(T, { children: [n > 0 && w("br", {}), t(e)] }, n));
}
export { GR as renderSideChatUserSegment, hl as sideChatTextBreaks };
