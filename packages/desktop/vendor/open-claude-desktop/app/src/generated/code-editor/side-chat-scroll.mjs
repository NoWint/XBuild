// Original kT scroll callback. Refs and per-session message store are supplied by the host.
const Aa = "epitaxy-user-turn";
const yT = 8;
const bT = 4;
const xT = {
  el: null,
  sessionId: null,
  turns: 0,
  reply: !1,
  height: 0,
  view: 0,
};
export function syncSideChatScroll(V, g, l, ne) {
  let e = V.current;
  if (!e) return;
  let t = (g && l?.getState().messagesBySession[g]) || [],
    n = t.at(-1)?.role === "assistant",
    r = ne.current;
  if (
    ((ne.current = {
      el: e,
      sessionId: g,
      turns: t.length,
      reply: n,
      height: e.scrollHeight,
      view: e.clientHeight,
    }),
    n)
  ) {
    if (
      r.reply &&
      r.sessionId === g &&
      r.turns === t.length &&
      e.scrollTop + r.view < r.height - bT
    )
      return;
    let n = e.querySelectorAll(`.${Aa}`),
      i = !!g && l?.getState().queuedBySession[g] !== void 0,
      a = n.item(n.length - (i ? 2 : 1));
    if (a) {
      let t =
        a.getBoundingClientRect().top -
        e.getBoundingClientRect().top +
        e.scrollTop -
        yT;
      e.scrollTo({ top: Math.max(e.scrollTop, t), behavior: "instant" });
      return;
    }
  }
  e.scrollTo({ top: e.scrollHeight, behavior: "instant" });
}
export { xT as emptySideChatScroll };
