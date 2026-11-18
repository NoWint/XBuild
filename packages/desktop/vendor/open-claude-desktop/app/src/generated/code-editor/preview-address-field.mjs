// Original current Preview address field; host supplies only CDS primitives and owner document.
import {
  useState as t,
  useEffect as n,
  useLayoutEffect as r,
  useRef as i,
  useCallback as o,
  useMemo as ee,
  memo as l,
} from "react";
import { jsx as a, jsxs as s } from "react/jsx-runtime";
export function createPreviewAddressField({
  Button: v,
  Spinner: ne,
  ownerDocument,
}) {
  const re = () => ownerDocument(),
    te = (doc) => doc?.defaultView,
    ie = () => true;
  const ae = {
    address: "Address",
    reload: "Reload",
    openExternal: "Open in default browser",
    loading: "Loading page",
  };
  const oe = [];
  const E = "shrink-0 rounded-sm";
  const D = "top";
  function se(e) {
    let t = e.ownerDocument.getSelection(),
      n = e.parentNode;
    t !== null &&
      t.rangeCount > 0 &&
      n !== null &&
      n.contains(t.anchorNode) &&
      t.removeAllRanges();
  }
  function ce(e, t, n) {
    let r = n === void 0 ? void 0 : /^https?:\/\//.exec(n)?.[0];
    if (n === void 0 || r === void 0 || !n.startsWith(e, r.length)) return null;
    let i = e.search(/[/?#]/);
    return t === 0 || t < (i === -1 ? e.length : i)
      ? null
      : t === e.length
        ? n
        : r + e.slice(0, t);
  }
  function le(e) {
    if (!e || /^[/\\~.]|\s/.test(e)) return null;
    try {
      let t = new URL(`http://${e}`);
      return !(
        t.hostname.includes(".") ||
        t.port !== "" ||
        t.hostname === "localhost"
      ) || !e.toLowerCase().startsWith(t.host)
        ? null
        : { host: e.slice(0, t.host.length), suffix: e.slice(t.host.length) };
    } catch {
      return null;
    }
  }
  const O = l(function ({
    value: e,
    url: c,
    onNavigate: l,
    onReload: u,
    onOpenExternal: d,
    placeholder: f,
    labels: p,
    className: m,
    focusRequest: h,
    autoFocusWhenEmpty: g = !1,
    keepDraftOnBlur: _ = !0,
    draftKey: y = "",
    liveDraftKeys: b = oe,
    pendingValue: x,
    pendingNewTabRef: S,
  }) {
    let C = ie(),
      [w, T] = t(null),
      O = i(null),
      k = i(y),
      A = i(!0),
      [j, M] = t(!1),
      N = o((e) => {
        ((A.current = e), M(!e));
      }, []),
      P = i(!1),
      F = i(!1),
      I = i(0),
      L = i(!1),
      R = b.join(`
`),
      {
        address: ue,
        reload: de,
        openExternal: fe,
        loading: pe,
      } = { ...ae, ...p },
      z = i(null),
      B = o((e, t) => {
        if (t === "all") {
          e.value !== "" && e.select();
          return;
        }
        e.setSelectionRange(t.start, t.end, t.dir);
      }, []),
      V = o(
        (e, t, n) => {
          if (e === n && O.current) {
            B(O.current, t);
            return;
          }
          z.current = { forText: e, sel: t };
        },
        [B],
      );
    n(() => {
      let e = z.current;
      if (e === null) return;
      z.current = null;
      let t = O.current;
      !t || w !== e.forText || B(t, e.sel);
    }, [w, B]);
    let H = () => {
        let e = O.current;
        return e !== null && e.ownerDocument.activeElement === e;
      },
      U = i(!1);
    n(() => {
      !g ||
        U.current ||
        ((U.current = !0), w === null && !H() && (O.current?.focus(), T("")));
    }, [g, w]);
    let W = i(void 0),
      G = i(new Map());
    n(() => {
      if (h === void 0 || h.key === W.current) return;
      ((W.current = h.key), (F.current = !1));
      let t = k.current !== y;
      if (t && G.current.has(y)) return;
      O.current?.focus();
      let n = w !== null && !A.current;
      if ((S && !(t && n) && (S.current.pending = !1), n)) {
        h.mode === "edit-current" && O.current?.select();
        return;
      }
      ((k.current = y),
        N(!0),
        h.mode === "blank" ? T("") : (V(e, "all", w), T(e)));
    }, [h, e, y, w, V, N, S]);
    let K = o((e) => {
      let t = O.current;
      return {
        text: e,
        start: t?.selectionStart ?? e.length,
        end: t?.selectionEnd ?? e.length,
        dir: t?.selectionDirection ?? "none",
      };
    }, []);
    (n(() => {
      let e = new Set(
        R.split(`
`),
      );
      for (let t of G.current.keys()) e.has(t) || G.current.delete(t);
    }, [R]),
      n(() => {
        let t = H();
        if (k.current !== y) {
          let n = k.current;
          ((k.current = y), (F.current = !1));
          let r = S?.current.pending === !0;
          if ((S && (S.current.pending = !1), w !== null && !A.current)) {
            if (r && I.current === S?.current.seq) {
              G.current.get(n)?.text === w && G.current.delete(n);
              return;
            }
            if (
              w !== "" &&
              R.split(
                `
`,
              ).includes(n)
            ) {
              let e = G.current.get(n);
              (e === void 0 || e.text !== w) && G.current.set(n, K(w));
            }
            N(!0);
          }
          let i = G.current.get(y);
          if (i !== void 0) {
            (N(!1), t && (G.current.delete(y), V(i.text, i, w)), T(i.text));
            return;
          }
          if (!t) {
            T(null);
            return;
          }
          (N(!0), V(e, "all", w), T(e));
          return;
        }
        if (w !== null && t && A.current) {
          if (w === e) return;
          (V(e, "all", w), T(e));
        }
      }, [y, e, w, V, R, S, K, N]));
    let q = re();
    n(() => {
      let e = te(q);
      if (!e || !_) return;
      let t,
        n = () => {
          (clearTimeout(t),
            (t = setTimeout(() => {
              e.document.hasFocus() || O.current?.blur();
            }, 80)));
        };
      return (
        e.addEventListener("blur", n),
        () => {
          (e.removeEventListener("blur", n), clearTimeout(t));
        }
      );
    }, [q, _]);
    let me = o(
        (t) => {
          if (((F.current = !1), w !== null && !A.current)) {
            let e = G.current.get(k.current);
            e !== void 0 &&
              e.text === w &&
              (G.current.delete(k.current),
              t.currentTarget.setSelectionRange(e.start, e.end, e.dir),
              (L.current = !0));
            return;
          }
          (T(e),
            (k.current = y),
            N(!0),
            t.currentTarget.select(),
            (L.current = !0));
        },
        [e, y, w, N],
      ),
      he = o((e) => {
        L.current && ((L.current = !1), e.preventDefault());
      }, []),
      ge = o(() => {
        let t = K(w ?? e);
        if ((O.current && se(O.current), P.current)) {
          ((P.current = !1), G.current.delete(k.current), N(!0), T(null));
          return;
        }
        if (_ && w && w !== e && !A.current) {
          G.current.set(k.current, t);
          return;
        }
        (N(!0), T(null));
      }, [w, e, _, K, N]),
      _e = o(
        (e) => {
          ((F.current = !1),
            A.current && S && (I.current = S.current.seq),
            N(!1),
            T(e.currentTarget.value));
        },
        [S, N],
      ),
      ve = o(
        (t) => {
          let n = t.currentTarget;
          if (n.value !== e || n.selectionStart !== 0) return;
          let r = ce(e, n.selectionEnd ?? 0, c);
          r !== null &&
            (t.clipboardData.setData("text/plain", r), t.preventDefault());
        },
        [e, c],
      ),
      ye = o(
        (t) => {
          if (t.nativeEvent.isComposing || t.keyCode === 229) {
            t.key === "Escape" && t.preventDefault();
            return;
          }
          if (
            (t.key !== "Escape" && (F.current = !1),
            !(t.repeat && t.key === "Enter"))
          ) {
            if (t.key === "Enter") {
              (t.preventDefault(),
                l(t.currentTarget.value) &&
                  ((P.current = !0), t.currentTarget.blur()));
              return;
            }
            if (t.key === "Escape") {
              t.preventDefault();
              let n = t.currentTarget;
              if (
                F.current &&
                !t.repeat &&
                A.current &&
                n.selectionStart === 0 &&
                n.selectionEnd === n.value.length
              ) {
                n.blur();
                return;
              }
              (t.stopPropagation(),
                (F.current = !0),
                G.current.delete(k.current),
                N(!0),
                V(e, "all", w),
                T(e));
              return;
            }
            (t.metaKey || t.ctrlKey) &&
              !t.shiftKey &&
              !t.altKey &&
              t.key.toLowerCase() === "l" &&
              t.currentTarget.select();
          }
        },
        [l, e, w, V, N],
      ),
      J = w !== null && j,
      Y = x || null,
      X = i(J);
    r(() => {
      if (X.current === J) return;
      X.current = J;
      let e = O.current;
      e === null ||
        H() ||
        (e.style.setProperty("transition-property", "none"),
        e.getBoundingClientRect(),
        e.style.removeProperty("transition-property"));
    }, [J]);
    let Z = e !== "" || Y !== null,
      Q = ee(() => le(e), [e]),
      be =
        Y === null
          ? u
            ? a(v, {
                icon: "ArrowClockwise",
                size: "sm",
                variant: "ghost",
                iconOnly: !0,
                tooltip: C,
                tooltipSide: D,
                "aria-label": de,
                onClick: u,
                className: E,
              })
            : null
          : a("span", {
              className: "grid h-5 w-5 shrink-0 place-items-center",
              children: a(ne, { size: "sm", label: pe }),
            });
    return s("div", {
      className: `flex h-control min-w-0 items-center gap-[4px] rounded bg-fill-field px-xs text-heading shadow-field-ring transition-shadow duration-150 ease-out [&:hover:not(:has(input:focus))]:shadow-field-hover has-[input:focus]:shadow-focus ${m ?? ""}`,
      children: [
        be,
        s("div", {
          className: "group/field relative h-full min-w-0 flex-1",
          children: [
            a("input", {
              ref: O,
              type: "text",
              value: w ?? e,
              placeholder: f,
              spellCheck: !1,
              autoComplete: "off",
              autoCorrect: "off",
              autoCapitalize: "off",
              "aria-label": ue,
              onFocus: me,
              onMouseUp: he,
              onBlur: ge,
              onChange: _e,
              onCopy: ve,
              onKeyDown: ye,
              className: `h-full w-full min-w-0 border-0 bg-transparent px-xs text-start text-ellipsis text-heading text-primary caret-[var(--cds-fill-accent)] outline-none hide-focus-ring transition-opacity motion-reduce:transition-none duration-[50ms] ease-out placeholder:opacity-0 focus:opacity-100 focus:delay-[150ms] ${J ? "opacity-100" : "opacity-0"}`,
            }),
            (w ?? e) === "" &&
              f !== void 0 &&
              a("span", {
                "aria-hidden": !0,
                className: `pointer-events-none absolute inset-0 flex items-center px-xs ${Z ? "opacity-0 transition-opacity motion-reduce:transition-none duration-[50ms] ease-out group-focus-within/field:opacity-100 group-focus-within/field:delay-[150ms]" : ""}`,
                children: a("span", {
                  className: "min-w-0 truncate text-heading text-muted",
                  children: f,
                }),
              }),
            !J &&
              Z &&
              s("span", {
                "aria-hidden": !0,
                className:
                  "pointer-events-none absolute inset-0 flex items-center px-xs transition-opacity motion-reduce:transition-none duration-[50ms] ease-out group-focus-within/field:opacity-0 group-focus-within/field:delay-[150ms]",
                children: [
                  a("span", {
                    className:
                      "min-w-0 basis-0 grow transition-[flex-grow] duration-150 ease-out group-focus-within/field:grow-0",
                  }),
                  Y === null
                    ? Q
                      ? s("span", {
                          className: "min-w-0 truncate text-heading",
                          children: [
                            a("span", {
                              className: "text-primary",
                              children: Q.host,
                            }),
                            Q.suffix &&
                              a("span", {
                                className: "text-muted",
                                children: Q.suffix,
                              }),
                          ],
                        })
                      : a("span", {
                          className:
                            "min-w-0 truncate text-heading text-primary",
                          children: e,
                        })
                    : a("span", {
                        className: "min-w-0 truncate text-heading text-muted",
                        children: Y,
                      }),
                  a("span", { className: "min-w-0 basis-0 grow" }),
                ],
              }),
          ],
        }),
        d &&
          a(v, {
            icon: "ArrowOutSquare",
            size: "sm",
            variant: "ghost",
            iconOnly: !0,
            tooltip: C,
            tooltipSide: D,
            "aria-label": fe,
            onClick: d,
            className: E,
          }),
      ],
    });
  });
  return O;
}
const displayPreviewURL = (() => {
  function X(e) {
    let t = e.replace(/^https?:\/\//, "");
    if (t === e) return e;
    let n = /^([^/?#]+)\/$/.exec(t)?.[1];
    return n === void 0 ? t : pe(n.slice(n.lastIndexOf("@") + 1)) ? n : t;
  }
  function pe(e) {
    if (/\s/.test(e)) return !1;
    let t = e.split(/[/?#]/, 1)[0] ?? "";
    return (
      t.includes(".") ||
      /^localhost(:\d+)?$/i.test(t) ||
      t.startsWith("[") ||
      /^[^:]+:\d+$/.test(t) ||
      (t.length > 0 && e[t.length] === "/")
    );
  }
  return X;
})();
export { displayPreviewURL };
