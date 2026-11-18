// Original selection hook. React and owner-window resolution supplied by host.
import {
  useState as t,
  useEffect as n,
  useRef as o,
  useCallback as l,
} from "react";
const S = (node) => node?.ownerDocument?.defaultView;
const ot = 2;
const st = 250;
function ct(e, r = {}) {
  let { containerOf: i, enabled: a = !0 } = r,
    [s, c] = t(null),
    [u, d] = t(""),
    f = o(!1),
    p = o(null),
    m = o(!1),
    h = o(!1),
    g = o(!1),
    _ = l(() => {
      ((p.current &&= (clearTimeout(p.current), null)), (g.current = !1));
    }, []),
    v = l((e, t) => {
      ((f.current = !0), c((t) => (t && lt(t, e) ? t : e.cloneRange())), d(t));
    }, []),
    y = l(() => {
      (_(), f.current && ((f.current = !1), c(null), d("")));
    }, [_]),
    b = l(() => {
      (y(), S(e.current)?.getSelection()?.removeAllRanges());
    }, [y, e]);
  return (
    n(() => {
      let t = e.current;
      if (!t || !a) return;
      let n = t.ownerDocument,
        r = n.defaultView;
      if (!r) return;
      let o = () => {
          let e = r.getSelection();
          if (!e || e.rangeCount === 0 || e.isCollapsed) {
            y();
            return;
          }
          let n = e.toString().trim();
          if (n.length < ot) {
            y();
            return;
          }
          let a = e.getRangeAt(0),
            o =
              a.startContainer.nodeType === Node.TEXT_NODE
                ? a.startContainer.parentNode
                : a.startContainer,
            s =
              a.endContainer.nodeType === Node.TEXT_NODE
                ? a.endContainer.parentNode
                : a.endContainer,
            c = i === void 0 ? t : ((o && i(o)) ?? (s && i(s)) ?? null);
          if (!c) {
            y();
            return;
          }
          let l = a.intersectsNode(c),
            u = o && c.contains(o),
            d = s && c.contains(s);
          if (!l || (!u && !d)) {
            y();
            return;
          }
          v(a, n);
        },
        s = () => {
          (_(),
            (p.current = setTimeout(() => {
              if (((p.current = null), m.current)) {
                g.current = !0;
                return;
              }
              o();
            }, st)));
        },
        c = () => {
          if (m.current) {
            ((h.current = !0), y());
            return;
          }
          s();
        },
        l = (e) => {
          e.defaultPrevented ||
            m.current ||
            ((m.current = !0), (h.current = !1));
        },
        u = (e) => {
          if (!m.current || e.buttons !== 0) return;
          m.current = !1;
          let t = g.current;
          if (((g.current = !1), !h.current)) {
            r.getSelection()?.isCollapsed === !1 ? t && s() : y();
            return;
          }
          if (e.detail === 2) {
            s();
            return;
          }
          o();
        };
      return (
        n.addEventListener("selectionchange", c),
        n.addEventListener("mousedown", l),
        n.addEventListener("mouseup", u),
        () => {
          (n.removeEventListener("selectionchange", c),
            n.removeEventListener("mousedown", l),
            n.removeEventListener("mouseup", u),
            y());
        }
      );
    }, [e, i, a, v, y, _]),
    { range: s, text: u, clearSelection: b, hideTooltip: y }
  );
}
function lt(e, t) {
  return (
    e.startContainer === t.startContainer &&
    e.startOffset === t.startOffset &&
    e.endContainer === t.endContainer &&
    e.endOffset === t.endOffset
  );
}
export { ct as useTranscriptSelection };
