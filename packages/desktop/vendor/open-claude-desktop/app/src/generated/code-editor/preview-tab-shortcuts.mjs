// Original native reopen/select/cycle key matchers and closed-tab history bounds.
const E5r = 35e3;
function A7r(e, t, n) {
  return e.type !== "keyDown" ||
    !t.cmdPressed ||
    t.otherModifierPressed ||
    e.shift !== n ||
    e.alt ||
    e.key.toLowerCase() !== "t"
    ? "pass"
    : e.isAutoRepeat || t.syntheticSuppressed
      ? "claim"
      : "forward";
}
function M7r(e, t) {
  return t.enabled ? A7r(e, t, !0) : "pass";
}
function z7r(e, t, n) {
  return e.type !== "keyDown" ||
    !t.cmdPressed ||
    t.otherModifierPressed ||
    e.shift ||
    e.alt ||
    !n(e)
    ? "pass"
    : e.isAutoRepeat || t.syntheticSuppressed
      ? "claim"
      : "forward";
}
function G7r(e, t) {
  if (e.type !== "keyDown" || !e.control || e.meta || e.alt) return "pass";
  let n = K7r(e, t.pageKeys ?? !1);
  return n === null ? "pass" : t.syntheticSuppressed ? "claim" : n;
}
function K7r(e, t) {
  return e.key.toLowerCase() === "tab"
    ? e.shift
      ? "previous"
      : "next"
    : !t || e.shift
      ? null
      : e.key === "PageDown"
        ? "next"
        : e.key === "PageUp"
          ? "previous"
          : null;
}
const q7r = /^Digit[1-9]$/;
function J7r(e, t) {
  let n = z7r(e, t, (e) => q7r.test(e.code));
  if (n !== "forward") return n;
  let r = Number(e.code.slice(5));
  return r === 9 ? -1 : r - 1;
}
const Fti = 25;
const Iti = 50;
function uoi(e, t) {
  let n = Date.now();
  return (e.set(t, n), n + E5r);
}
function doi(e, t, n, r = !0) {
  e.delete(t);
  let i = Date.now(),
    a = 0;
  for (let [t, n] of e) r && i - n >= 35e3 ? e.delete(t) : n > a && (a = n);
  return e.size === 0 ? i + 200 : Math.min(n, a + E5r);
}
export {
  M7r as reopenTabKey,
  J7r as selectTabKey,
  G7r as cycleTabKey,
  Fti as closedTabsPerSession,
  Iti as closedTabSessions,
  uoi as beginSyntheticInput,
  doi as endSyntheticInput,
};
