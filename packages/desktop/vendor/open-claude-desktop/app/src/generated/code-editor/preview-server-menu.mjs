// Original current split dev-server menu and section/action builder.
import {
  useState as e,
  useCallback as l,
  useMemo as p,
  memo as f,
  Fragment as s,
} from "react";
import { jsx as o, jsxs as u } from "react/jsx-runtime";
export function createPreviewServerMenu({
  Menu: G,
  Tooltip: be,
  Button: H,
  Spinner: Ce,
  Provider: c,
  useStable: g,
  useOptionalStable: v,
  usePortal: we,
  useIntl: Oe,
  renderItems: Ln,
  collisionPadding: w,
}) {
  const En = (event) => event.preventDefault();
  function Mr(e) {
    e.preventDefault();
  }
  const Nr = {
    trigger: "Dev servers",
    header: "Servers",
    run: "Run",
    stop: "Stop",
    stopAll: "Stop all servers",
    runningState: "Running",
    stoppedState: "Stopped",
    starting: "Starting",
    addServer: "Add server",
    empty: "No dev server configured",
  };
  function Pr({ servers: e, extraSections: t, onAddServer: n, loading: r }) {
    let i = t !== void 0 && t.some((e) => e.items.length > 0);
    return r === !0 && e.length === 0 ? !i : (e.length, !1);
  }
  function Fr(e, t) {
    return e
      .filter((e) => e.items.length > 0)
      .map((e, n) =>
        u(
          s,
          {
            children: [
              n > 0 && !e.noSeparator && o(G.Separator, {}),
              u(G.Group, {
                children: [
                  e.header && o(G.GroupLabel, { children: e.header }),
                  e.items.map(t),
                ],
              }),
            ],
          },
          e.key ?? n,
        ),
      );
  }
  function Ir({
    servers: e,
    extraSections: t,
    onRun: n,
    onStop: r,
    onStopAll: i,
    onAddServer: a,
    loading: s,
    labels: l,
    onAction: d,
  }) {
    let f = g(n),
      m = g(r),
      h = v(i),
      _ = v(a),
      y = v(d),
      b = i !== void 0 && e.length > 1 && e.some((e) => e.running),
      x = a !== void 0,
      S = t !== void 0 && t.some((e) => e.items.length > 0),
      {
        trigger: ee,
        header: C,
        run: w,
        stop: T,
        stopAll: E,
        runningState: D,
        stoppedState: O,
        starting: k,
        addServer: A,
        empty: j,
      } = { ...Nr, ...l },
      M = s === !0 && e.length === 0;
    return {
      trigger: ee,
      sections: p(() => {
        if (M) return S ? t.filter((e) => e.items.length > 0) : [];
        let n = e.map((e) => {
            let t = () => {
              (e.running ? m(e.id) : f(e.id), y?.());
            };
            return {
              value: e.id,
              label: u(c, {
                children: [
                  o("span", { "aria-hidden": !0, children: e.label }),
                  o("span", {
                    className: "sr-only",
                    children: e.starting
                      ? e.label
                      : `${e.label}, ${e.running ? D : O}`,
                  }),
                ],
              }),
              onSelect: t,
              leading: e.starting ? o(Ce, { size: "sm", label: k }) : void 0,
              trailing: o(H, {
                size: "sm",
                variant: e.running ? "danger" : "secondary",
                icon: e.running ? "Stop" : "Play",
                iconOnly: !0,
                "aria-label": e.running ? T : w,
                tooltip: !1,
                tabIndex: -1,
                "aria-hidden": !0,
                onMouseDown: En,
                onClick: (e) => {
                  (e.stopPropagation(), t());
                },
                className: "min-w-8 shrink-0",
              }),
            };
          }),
          r = [];
        n.length > 0
          ? r.push({ key: "servers", header: C, items: n })
          : !x &&
            !S &&
            r.push({
              key: "servers",
              header: C,
              items: [{ label: j, disabled: !0 }],
            });
        let i = S ? t.filter((e) => e.items.length > 0) : [];
        return (
          r.push(...i),
          b &&
            r.push({
              key: "stop-all",
              noSeparator: i.length === 0,
              items: [
                { value: "stop-all", label: E, variant: "danger", onSelect: h },
              ],
            }),
          x &&
            r.push({
              key: "add-server",
              items: [{ value: "add-server", label: A, onSelect: _ }],
            }),
          r
        );
      }, [e, M, x, S, t, b, C, f, m, h, _, y, w, T, E, A, D, O, k, j]),
    };
  }
  const Lr = f(function ({
    servers: t,
    extraSections: n,
    onRun: r,
    onStop: i,
    onStopAll: a,
    onAddServer: s,
    loading: c,
    disabled: d,
    side: f = "bottom",
    align: m = "end",
    open: h,
    onOpenChange: _,
    labels: v,
    className: y,
  }) {
    let [b, x] = e(!1),
      S = h ?? b,
      ee = g((e) => {
        (x(e), _?.(e));
      }),
      C = l(() => ee(!1), [ee]),
      T = we(),
      E = Oe(),
      D = p(() => Ln(T, E), [T, E]),
      { trigger: O, sections: k } = Ir({
        servers: t,
        extraSections: n,
        onRun: r,
        onStop: i,
        onStopAll: a,
        onAddServer: s,
        loading: c,
        labels: v,
        onAction: C,
      }),
      A = k.length === 0,
      j = d === !0 || A;
    b && A && x(!1);
    let M = S && !A;
    return u(G.Root, {
      open: M,
      onOpenChange: ee,
      children: [
        o(be, {
          content: O,
          open: !M && void 0,
          children: o(G.Trigger, {
            disabled: j,
            render: o(H, {
              variant: "ghost",
              iconOnly: !0,
              icon: "Cache",
              "aria-label": O,
              tooltip: !1,
              className: y,
            }),
          }),
        }),
        o(G.Popup, {
          side: f,
          align: m,
          container: T,
          collisionPadding: w,
          onContextMenu: Mr,
          children: Fr(k, D),
        }),
      ],
    });
  });
  return { Menu: Lr, useSections: Ir, isEmpty: Pr };
}
