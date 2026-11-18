// Original current status-label hook; React supplied by host.
import { useState as g, useEffect as b, useRef as D } from "react";
function pj(e, t, n, r) {
  let [i, a] = g(e),
    [o, s] = g(r),
    c = r !== o;
  c && s(r);
  let l = n?.restKey,
    u = n?.fallHoldMs ?? 0,
    d = l !== void 0 && e === l,
    f = l !== void 0 && i === l,
    p = !f && !d && e !== i && n?.isAdvance?.(i, e) === !0,
    m = c || f || p ? e : i;
  m !== i && a(m);
  let h = D(m),
    _ = D(0),
    v = D(null);
  return (
    b(() => {
      let n = performance.now();
      if (
        (h.current !== m && ((h.current = m), (_.current = n)),
        d ? v.current === null && (v.current = n) : (v.current = null),
        e === m)
      )
        return;
      let r = n - _.current,
        i = Math.max(t - r, d ? u - (n - (v.current ?? n)) : 0);
      if (i <= 0) {
        a(e);
        return;
      }
      let o = setTimeout(() => a((t) => (t === m ? e : t)), i);
      return () => clearTimeout(o);
    }, [e, t, m, d, u]),
    m
  );
}
const $tt = 150;
function Z8(e, t, n) {
  let [r, i] = g({ working: n, epoch: 0 }),
    a = n && !r.working;
  n !== r.working && i({ working: n, epoch: a ? r.epoch + 1 : r.epoch });
  let [o, s] = g(e),
    c = e === null && t ? o : e,
    l = c !== o && (a || c === null || o === null);
  (l && s(c),
    b(() => {
      if (c === o || c === null || o === null) return;
      let e = setTimeout(() => s(c), $tt);
      return () => clearTimeout(e);
    }, [c, o]));
  let u = pj((l ? c : o) ?? "", 650, void 0, r.epoch);
  return u === "" ? null : u;
}
export { Z8 as useSideChatStatusLabel };
