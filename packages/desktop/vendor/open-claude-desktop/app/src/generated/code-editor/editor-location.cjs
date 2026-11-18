// Original desktop tm/im encoding and local URI/suffix expressions. Host supplies protocol/path/position.
function tm(e) {
  let t = encodeURIComponent(e).replace(/%2F/g, "/");
  if (decodeURIComponent(t) !== e || /["\s<>|^&]/.test(t))
    throw Error("Refusing to build editor URI: path failed encode round-trip");
  return t;
}
function im(e) {
  return tm(e);
}
function editorLocationURI(a, u, i, o) {
  let d = Number.isInteger(o) && o > 0 ? `:${o}` : "",
    f = Number.isInteger(i) && i > 0 ? `:${i}${d}` : "",
    p;
  return `${a}file/${im(u)}${f}`;
}
module.exports = { editorLocationURI };
