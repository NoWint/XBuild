// Original terminal selection geometry, with no desktop dependencies.
var Br = 8,
  Vr = 16,
  Hr = 12,
  Ur = 0;
function Wr({ start: e, end: t }) {
  return t.x === 0 && t.y > e.y ? t.y - 1 : t.y;
}
function Gr(e, t, n, r) {
  let i = e.element?.querySelector(".xterm-screen");
  if (!i || !t || i.clientHeight <= 0) return;
  let a = i.clientHeight / e.rows,
    o = i.getBoundingClientRect().top - t.getBoundingClientRect().top,
    { viewportY: s } = e.buffer.active,
    c = o + (r.start.y - s) * a,
    l = o + (Wr(r) - s + 1) * a;
  return ((Ur += 1), { id: Ur, top: c, bottom: l, below: n >= c + a });
}
function Kr(e) {
  let t;
  for (let n = e.length - 1; n >= 0; --n)
    if (((t = e.getCell(n, t)), t && t.getChars().trim() !== ""))
      return n + t.getWidth();
  return 0;
}
function qr(e, t) {
  let { start: n, end: r } = t;
  return (
    n.x === 0 &&
    n.y === 0 &&
    r.x === e.cols &&
    r.y === e.buffer.active.baseY + e.rows - 1
  );
}
function Jr(e, t) {
  let n = e.element?.querySelector(".xterm-screen");
  if (!n || !t || n.clientHeight <= 0) return;
  let { active: r } = e.buffer,
    i = e.rows,
    a = 0;
  for (; a === 0 && i > 0; ) {
    --i;
    let e = r.getLine(r.viewportY + i);
    a = e ? Kr(e) : 0;
  }
  if (a === 0) return;
  r.baseY + r.cursorY - r.viewportY === i && (a = Math.max(a, r.cursorX + 1));
  let o = n.clientHeight / e.rows,
    s = n.getBoundingClientRect(),
    c = t.getBoundingClientRect(),
    l = s.top - c.top + i * o;
  return (
    (Ur += 1),
    {
      x: s.left - c.left + Math.min(a, e.cols) * (n.clientWidth / e.cols),
      y: l + o / 2,
      sel: { id: Ur, top: l, bottom: l + o, below: !0 },
      beside: !0,
    }
  );
}
function Yr(e, t, n, r) {
  let i = t.width / 2;
  if (e.beside) {
    let r = e.x + Br + i,
      a = e.y + t.height / 2;
    if (r + i <= n.width && a <= n.height && a >= t.height)
      return { left: Math.round(r), top: Math.round(a) };
  }
  let a = Math.min(n.width - i, Math.max(i, e.x)),
    o = (e) => e >= t.height && e <= n.height,
    { sel: s } = e,
    c;
  if (s) {
    let n = Math.min(s.top, e.y) - Br,
      i = Math.max(s.bottom + Br, e.y + Vr) + t.height,
      a = (
        (r ?? (s.below ? "below" : "above")) === "below"
          ? ["below", "above"]
          : ["above", "below"]
      ).find((e) => o(e === "below" ? i : n));
    c = a && { top: a === "below" ? i : n, side: a };
  }
  return (
    (c ??= { top: e.y - Br >= t.height ? e.y - Br : e.y + Vr + t.height }),
    { left: Math.round(a), top: Math.round(c.top), side: c.side }
  );
}

export {
  Wr as terminalSelectionEndRow,
  Gr as terminalSelectionBox,
  qr as isWholeTerminalSelection,
  Jr as wholeTerminalSelectionAnchor,
  Yr as terminalSelectionPillPosition,
};
