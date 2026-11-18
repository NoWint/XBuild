// Original terminal-program context-menu ownership. Platform detection is supplied by the host.
export function terminalOwnsContextMenu(term, event, mac) {
  const E = () => mac;
  function Fr(e, t) {
    let n = E(),
      r = t.button === 2 || (n && t.ctrlKey),
      i = e.element?.contains(t.target) === !0;
    return !r || !i || e.modes.mouseTrackingMode === "none"
      ? !1
      : !(n
          ? t.altKey && e.options.macOptionClickForcesSelection === !0
          : t.shiftKey);
  }
  return Fr(term, event);
}
