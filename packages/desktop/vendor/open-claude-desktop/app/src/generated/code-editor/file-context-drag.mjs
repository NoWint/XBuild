// Original in-window file-context drag protocol; rollout enabled locally.
const D = () => true;
const w = "application/x-claude-file-context";
let T = null;
function E() {
  T = null;
}
function O(e, t, n, r) {
  if (!D()) {
    e.preventDefault();
    return;
  }
  (e.dataTransfer.setData(w, "1"),
    (e.dataTransfer.effectAllowed = "copy"),
    (T = { owner: t, attach: n, absPaths: r }),
    e.currentTarget.addEventListener("dragend", E, { once: !0 }));
}
function k(e) {
  return e.dataTransfer?.types?.includes(w) ?? !1;
}
function A(e) {
  return T !== null && T.owner === e ? T.absPaths : void 0;
}
function j() {
  let e = T;
  ((T = null), e?.attach());
}
export {
  O as beginFileContextDrag,
  k as isFileContextDrag,
  A as draggedFilePaths,
  j as commitFileContextDrag,
  E as clearFileContextDrag,
};
