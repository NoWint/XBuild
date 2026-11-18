// Original selected/visible terminal output attachment and replay-banner normalization.
const kn = "[shell reconnected \u2014 replaying buffered output]";
function jn(e) {
  return e > 0 ? Math.ceil(47 / e) : 1;
}
function Mn(e) {
  if (!e.startsWith(kn)) return e;
  let t = e.slice(47),
    n = t.startsWith(`\r
`)
      ? 2
      : +!!t.startsWith(`
`),
    r = t.slice(n);
  return n > 0 && r.trim() !== "" ? r : e;
}
function Nn(e) {
  let t = e.trimEnd().length,
    n = e.indexOf(
      `
`,
      t,
    );
  return t === 0 || n < 0 ? e : e.slice(0, e[n - 1] === "\r" ? n - 1 : n);
}
function Pn(e) {
  return Mn(Nn(e));
}
function Kn(e, t) {
  let n = e.hasSelection();
  if (!n) {
    let { active: t } = e.buffer,
      n = t.viewportY,
      r = jn(e.cols);
    for (; n > 0 && n < r && t.getLine(n)?.isWrapped; ) --n;
    e.selectLines(n, t.viewportY + e.rows - 1);
  }
  let r = Pn(e.getSelection());
  return !t || !r.trim()
    ? (n || e.clearSelection(), !1)
    : (e.clearSelection(), t(r), !0);
}
export { Kn as attachVisibleTerminalOutput, Pn as terminalSelectionText };
