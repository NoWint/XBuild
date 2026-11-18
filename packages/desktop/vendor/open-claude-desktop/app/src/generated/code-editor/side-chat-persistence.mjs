// Original stored panel rectangle parser; storage object supplied by host.
export function readSideChatPanelRect(localStorage, key) {
  function Xn(e) {
    try {
      let t = JSON.parse(localStorage.getItem(e) ?? "null");
      if (typeof t != "object" || !t) return null;
      let { left: n, top: r, width: i, height: a, viewport: o } = t;
      if (![n, r, i, a].every(Number.isFinite)) return null;
      let s = { left: n, top: r, width: i, height: a },
        c = Zn(o);
      return c ? { ...s, viewport: c } : s;
    } catch {
      return null;
    }
  }
  function Zn(e) {
    if (typeof e != "object" || !e) return;
    let { width: t, height: n } = e;
    return [t, n].every(Number.isFinite) ? { width: t, height: n } : void 0;
  }
  return Xn(key);
}
