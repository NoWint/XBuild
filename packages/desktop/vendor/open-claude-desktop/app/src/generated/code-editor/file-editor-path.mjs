// Original non-text/image exclusion used by file-menu editor actions.
const Ba = ["png", "jpg", "jpeg", "gif", "bmp", "webp"];
const Va = [...Ba, "avif"];
function qa(e) {
  let t = e.lastIndexOf(".");
  return t < 0 ? "" : e.slice(t + 1).toLowerCase();
}
function Ya(e, t) {
  let n = qa(e);
  return t?.allowSvg && n === "svg" ? !0 : Va.includes(n);
}
const sa = Ya;
function mk(e) {
  return sa(e);
}
const kk =
  /\.(doc[xm]?|xls[xm]?|ppt[xm]?|od[tsp]|rtf|epub|mobi|pages|numbers|zip|t?gz|tar|bz2|xz|zst|7z|rar|jar|war|dmg|iso|deb|rpm|apk|msi|pkg|img|wasm|exe|dll|so(?:\.\d+)*|dylib|bin|class|pyc|o|a|db|sqlite3?|parquet|woff2?|ttf|otf|eot|pdf|mp4|webm|m4v|mov|ogv|avi|mkv|wmv|flv|mpe?g|m2ts|3gp|mp3|m4a|aac|flac|wav|ogg|oga|opus|aiff?|wma|midi?|ico|tiff?|heic|heif|jfif|psd|tga|dng|svgz)$/i;
function Ak(e) {
  return !kk.test(e) && !mk(e);
}
export { Ak as canOpenFileInEditor };
