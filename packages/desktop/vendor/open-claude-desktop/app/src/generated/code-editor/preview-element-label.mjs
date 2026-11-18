// Original composer element labels, including surrogate-safe forty-character truncation.
import {
  selectedElementComponent as y_,
  selectedElementTag as x_,
} from "./preview-element-serialization.mjs";
const b_ = (e) => "source" in e && e.source === "simulator";
const g_ = (() => {
  function D(e) {
    return typeof e == "string" && e.trim().length > 0 ? e : null;
  }
  function Ke(e) {
    if (e == null) return null;
    if (typeof e == "string") return e;
    if (typeof e == "number" || typeof e == "boolean") return String(e);
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  function qe(e) {
    let t = D(e.label) ?? D(e.title) ?? D(Ke(e.value)) ?? D(e.identifier);
    return t === null
      ? null
      : (
          t
            .split(
              `
`,
            )
            .find((e) => e.trim()) ?? t
        ).trim();
  }
  return qe;
})();
function lO(e, t = "Element", n = !1) {
  if (b_(e)) return uO(e, t, n);
  let r = y_(e)?.name,
    i = r ? `<${r} />` : x_(e),
    a = e.innerText ? fO(e.innerText) : "";
  return a ? `${i} ${a}` : i;
}
function uO(e, t, n) {
  let r = e.type && e.type.length > 0 ? e.type : t,
    i = g_(e),
    a = i === null ? r : `${r} ${JSON.stringify(fO(i))}`;
  return n && e.instruction !== void 0 ? `${a} \u00B7 ${fO(e.instruction)}` : a;
}
const dO = 40;
function fO(e) {
  let t = (
    e
      .split(
        `
`,
      )
      .find((e) => e.trim()) ?? e
  ).trim();
  if (t.length <= dO) return t;
  let n = t.charCodeAt(38),
    r = n >= 55296 && n <= 56319 ? 38 : 39;
  return `${t.slice(0, r)}\u2026`;
}
function pO(e) {
  return e ? `data:image/png;base64,${e}` : null;
}
export { lO as selectedElementLabel, pO as selectedElementScreenshot };
