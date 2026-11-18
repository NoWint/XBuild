function Ju(e, t, n) {
  return t === e.url ? e : { url: t, settled: n, prompted: !1 };
}
function Yu(e) {
  return {
    canRoute: e.linksInPreview && e.infraOk,
    explicitReady: e.infraOk && e.hasLocalDisk,
  };
}
function Xu(e) {
  return e.hasPendingUrl
    ? e.chooserOpen
      ? "hold"
      : e.explicit
        ? e.infraOk
          ? "dispatch"
          : "release"
        : !e.chooserSeen &&
            !e.alreadyPrompted &&
            e.settledAtUrlArrival &&
            e.linksInPreview &&
            e.infraOk
          ? "prompt"
          : e.linksInPreview && e.infraOk
            ? "dispatch"
            : "none"
    : "none";
}
function Zu(e) {
  return e.explicit
    ? "keep"
    : e.confirmed
      ? e.inPreview
        ? "keep"
        : "release"
      : "drop";
}
export {
  Ju as linkArrival,
  Yu as linkCapabilities,
  Xu as linkDispatch,
  Zu as linkConfirmation,
};
