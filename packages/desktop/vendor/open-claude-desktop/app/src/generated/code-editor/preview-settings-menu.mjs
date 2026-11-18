// Original Preview settings sections, menu wrapper and clear-data dialog.
import { useMemo as l, memo as c } from "react";
import { jsx as i } from "react/jsx-runtime";
export function createPreviewSettingsMenu({
  useOptionalStable: u,
  PaneMenu: A,
  ConfirmDialog: T,
  useIntl: D,
}) {
  const oe = {
    showSessionLogs: "Show dev server logs",
    allowedSites: "Manage allowed sites\u2026",
    importChromeLogins: "Import cookies\u2026",
    useImportedCookies: "Use cookies you already imported",
    openLinksInPreview: "Open links in Browser panel",
    clearBrowsingData: "Clear browsing data",
    cookiesHeader: "Cookies",
    keepCookies: "Keep cookies",
    persistNone: "Until quit",
    persistNoneHint: "Cookies are cleared when the app quits",
    persistShared: "Shared",
    persistSharedHint: "Cowork and all Code sessions share cookies",
    persistSession: "Per session",
    persistSessionHint: "Each session keeps its own cookies",
    autoVerify: "Auto-verify changes",
    openExternal: "Open in default browser",
    openExternalUnavailable: "This only works for websites.",
    copyUrl: "Copy URL",
    openFile: "Open HTML file\u2026",
    screenshot: "Save screenshot",
    showAnnotationTools: "Show annotation tools",
    export: "Export",
    viewport: "Viewport",
    viewportUnavailable: "Open a page first.",
    colorScheme: "Color scheme",
    colorSchemeLight: "Light",
    colorSchemeDark: "Dark",
    colorSchemeSystem: "System",
  };
  const se = ["none", "shared", "session"];
  function ce(e, t) {
    return t === "none"
      ? e.persistNone
      : t === "shared"
        ? e.persistShared
        : e.persistSession;
  }
  function B({
    onShowSessionLogs: e,
    onAllowedSites: t,
    onImportChromeLogins: n,
    onUseImportedCookies: r,
    onClearBrowsingData: i,
    openLinksInPreview: a,
    onOpenLinksInPreviewChange: o,
    previewStorage: s,
    onPreviewStorageChange: c,
    autoVerify: d,
    onAutoVerifyChange: f,
    onOpenExternal: p,
    openExternalDisabled: m,
    onCopyUrl: h,
    copyUrlDisabled: g,
    onOpenFile: _,
    onScreenshot: v,
    screenshotDisabled: y,
    onShowAnnotationTools: ee,
    showAnnotationToolsDisabled: b,
    onExport: x,
    exportDisabled: te,
    viewportItems: S,
    viewportHint: C,
    viewportDisabled: w,
    colorScheme: T,
    onColorScheme: E,
    labels: D,
  }) {
    let O = u(e),
      k = u(t),
      ne = u(n),
      A = u(r),
      j = u(i),
      M = u(o),
      N = u(p),
      re = u(h),
      P = u(_),
      F = u(v),
      ie = u(ee),
      I = u(x),
      ae = u(E),
      L = u(c),
      R = u(f),
      z = e !== void 0,
      B = t !== void 0,
      V = n !== void 0,
      H = r !== void 0,
      U = i !== void 0,
      W = o !== void 0,
      G = p !== void 0,
      K = h !== void 0,
      le = _ !== void 0,
      q = v !== void 0,
      ue = ee !== void 0,
      J = x !== void 0,
      Y = E !== void 0,
      de = f !== void 0,
      X = c !== void 0,
      Z = l(() => ({ ...oe, ...D }), [D]);
    return {
      sections: l(() => {
        let e = [];
        (G &&
          e.push({
            label: Z.openExternal,
            disabled: m,
            disabledReason: Z.openExternalUnavailable,
            onSelect: N,
          }),
          K &&
            e.push({
              label: Z.copyUrl,
              disabled: g,
              disabledReason: Z.openExternalUnavailable,
              onSelect: re,
            }),
          q && e.push({ label: Z.screenshot, disabled: y, onSelect: F }),
          ue &&
            e.push({ label: Z.showAnnotationTools, disabled: b, onSelect: ie }),
          le && e.push({ label: Z.openFile, onSelect: P }),
          J && e.push({ label: Z.export, disabled: te, onSelect: I }));
        let t = [];
        (S !== void 0 &&
          t.push({
            label: Z.viewport,
            hint: C,
            disabled: w,
            disabledReason: Z.viewportUnavailable,
            items: S,
          }),
          Y &&
            t.push({
              label: Z.colorScheme,
              items: ["light", "dark", "system"].map((e) => ({
                label:
                  e === "light"
                    ? Z.colorSchemeLight
                    : e === "dark"
                      ? Z.colorSchemeDark
                      : Z.colorSchemeSystem,
                checked: T === e,
                checkedRole: "radio",
                onSelect: () => ae?.(e),
              })),
            }),
          z && t.push({ label: Z.showSessionLogs, onSelect: O }));
        let n = [];
        (W &&
          n.push({
            label: Z.openLinksInPreview,
            checked: a,
            checkedRole: "checkbox",
            keepOpen: !0,
            onSelect: () => M?.(!a),
          }),
          de &&
            n.push({
              label: Z.autoVerify,
              checked: d,
              checkedRole: "checkbox",
              keepOpen: !0,
              onSelect: () => R?.(!d),
            }),
          B && n.push({ label: Z.allowedSites, onSelect: k }));
        let r = [];
        return (
          V && r.push({ label: Z.importChromeLogins, onSelect: ne }),
          H && r.push({ label: Z.useImportedCookies, onSelect: A }),
          X &&
            s !== void 0 &&
            r.push({
              label: Z.keepCookies,
              hint: ce(Z, s),
              items: se.map((e) => ({
                label: ce(Z, e),
                description:
                  e === "none"
                    ? Z.persistNoneHint
                    : e === "shared"
                      ? Z.persistSharedHint
                      : Z.persistSessionHint,
                checked: s === e,
                checkedRole: "radio",
                onSelect: () => L?.(e),
              })),
            }),
          U &&
            r.push({
              label: Z.clearBrowsingData,
              variant: "danger",
              onSelect: j,
            }),
          [
            { items: e },
            { items: t },
            { items: n },
            { header: Z.cookiesHeader, items: r },
          ].filter((e) => e.items.length > 0)
        );
      }, [
        Z,
        z,
        B,
        V,
        H,
        U,
        W,
        a,
        G,
        m,
        K,
        g,
        le,
        q,
        ue,
        b,
        J,
        Y,
        de,
        X,
        s,
        d,
        y,
        te,
        S,
        C,
        w,
        T,
        O,
        k,
        ne,
        A,
        j,
        M,
        N,
        re,
        P,
        F,
        ie,
        I,
        ae,
        L,
        R,
      ]),
    };
  }
  const V = c(function ({ paneName: e, onOpenChange: t, ...n }) {
    let { sections: r } = B(n);
    return i("span", {
      "data-preview-settings-menu": !0,
      className: "contents",
      children: i(A, {
        sections: r,
        onOpenChange: t,
        paneName: e,
        unroll: !1,
        disabled: n.disabled,
      }),
    });
  });
  const H = c(function ({
    isOpen: e,
    previewStorage: t,
    onClose: n,
    onConfirm: r,
  }) {
    let a = D();
    return i(T, {
      open: e,
      onOpenChange: (e) => {
        e || n();
      },
      onConfirm: r,
      title: a.formatMessage({
        defaultMessage: "Clear browsing data?",
        id: "NJWsttItt/",
      }),
      description:
        t === "shared"
          ? a.formatMessage({
              defaultMessage:
                "This deletes the cookies, sign-ins, and site data the browser saves for every Code session and Cowork. You\u2019ll need to sign in to sites again.",
              id: "jp9NW95hOO",
            })
          : a.formatMessage({
              defaultMessage:
                "This deletes the cookies, sign-ins, and site data saved for this session\u2019s browser. You\u2019ll need to sign in to sites again.",
              id: "5LIyxTSh0P",
            }),
      confirmLabel: a.formatMessage({
        defaultMessage: "Clear data",
        id: "wycwyUK5pQ",
      }),
      confirmVariant: "danger",
    });
  });
  return { Menu: V, useSections: B, ClearDataDialog: H, labels: oe };
}
