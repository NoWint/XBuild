// Original blank-area pointer selection rules, including scrollbar exclusion.
function Jv(e) {
  let t = e.target;
  return e.currentTarget.contains(t) && t.closest("[data-tree-row]") === null;
}
function Yv(e) {
  let t = e.currentTarget;
  if (e.button !== 0 || !Jv(e)) return !1;
  let n = t.getBoundingClientRect();
  return !(
    (t.offsetWidth > t.clientWidth &&
      e.clientX >= n.left + t.clientLeft + t.clientWidth) ||
    (t.offsetHeight > t.clientHeight &&
      e.clientY >= n.top + t.clientTop + t.clientHeight)
  );
}
export { Jv as isBlankTreeTarget, Yv as isBlankTreePress };
