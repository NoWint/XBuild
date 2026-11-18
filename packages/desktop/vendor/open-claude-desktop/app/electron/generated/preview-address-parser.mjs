// Original current Preview address classifier and Unicode normalization.
function LU(e, t) {
  let n = "";
  for (let r = 0; r < e.length; r++) {
    let i = e.charCodeAt(r),
      a = r + 1 < e.length ? e.charCodeAt(r + 1) : 0;
    i >= 55296 && i <= 56319 && a >= 56320 && a <= 57343
      ? ((n += e.slice(r, r + 2)), r++)
      : (n += i >= 55296 && i <= 57343 ? t : e.charAt(r));
  }
  return n;
}
function RU(e) {
  let t = e.isWellFormed;
  if (typeof t == "function") return t.call(e);
  for (let t = 0; t < e.length; t++) {
    let n = e.charCodeAt(t);
    if (n >= 55296 && n <= 56319) {
      let n = t + 1 < e.length ? e.charCodeAt(t + 1) : 0;
      if (n < 56320 || n > 57343) return !1;
      t++;
    } else if (n >= 56320 && n <= 57343) return !1;
  }
  return !0;
}
function zU(e) {
  let t = e.toWellFormed;
  return typeof t == "function" ? t.call(e) : LU(e, "\uFFFD");
}
function BU(e) {
  return RU(e) ? e : LU(e, "");
}
const p = BU,
  m = zU,
  h = RU;
const G = /^([a-z][a-z0-9+.-]*):\/\//i;
const K = new Set(["http", "https"]);
const le = /^(localhost|127(\.\d+){3}|\[?::1\]?|0\.0\.0\.0)$/i;
const q = /^[A-Za-z]:[/\\]/;
const ue = /^["'`\u2018-\u201F\s]*\\\\/;
const J = /^[/\\~$%]/;
function Y(e) {
  return e.endsWith(".localhost") || le.test(e);
}
function de(e) {
  return e.endsWith(".") ? e.slice(0, -1) : e;
}
function X(e) {
  let t = e.replace(/^https?:\/\//, "");
  if (t === e) return e;
  let n = /^([^/?#]+)\/$/.exec(t)?.[1];
  return n === void 0 ? t : pe(n.slice(n.lastIndexOf("@") + 1)) ? n : t;
}
const Z = /[^\s:@]*:(?!\/\/)[^\s@]+@/;
const fe = /(?:^|[^\w-])(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|glpat-)[^\s@]*@/i;
function Q(e) {
  return Z.test(e) || fe.test(e)
    ? null
    : {
        kind: "search",
        url: `https://www.google.com/search?q=${encodeURIComponent(m(e))}`,
      };
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
function me(e, t) {
  let n = he(e, t);
  if (n?.kind === "search" && !h(e)) {
    let n = p(e);
    if (J.test(n.trim()) || he(n, t)?.kind !== "search") return null;
  }
  return n;
}
function he(e, t) {
  let n = e.trim();
  if (!n) return null;
  let r = null;
  try {
    r = new URL(t);
  } catch {
    r = null;
  }
  let i = r !== null && (r.protocol === "http:" || r.protocol === "https:");
  if (i && (n === t || n === X(t))) return { kind: "navigate", url: t };
  if (ue.test(n)) return null;
  let a = n.slice(1, -1),
    o = a.trim();
  if (n === `"${a}"` && !a.includes('"') && q.test(o))
    return { kind: "file", path: o };
  if (/^file:/i.test(n)) {
    let e;
    try {
      let t = new URL(n);
      if (t.protocol !== "file:") return null;
      e = t.hostname;
    } catch {
      return null;
    }
    return e !== "" && e !== "localhost" ? null : { kind: "file", path: n };
  }
  if (
    /^~($|[/\\])/.test(n) ||
    /^\.\.?[/\\]/.test(n) ||
    q.test(n) ||
    (/^\/(?!\/)/.test(n) && !i)
  )
    return { kind: "file", path: n };
  if (r !== null && r.protocol === "file:" && (J.test(n) || /\s/.test(n)))
    return null;
  let s = G.exec(n);
  if (s) {
    if (!K.has(s[1].toLowerCase())) return Q(n);
    try {
      return (new URL(n), { kind: "navigate", url: n });
    } catch {
      return Q(n);
    }
  }
  if (n.startsWith("/") && i && r !== null)
    return { kind: "navigate", url: `${r.protocol}//${r.host}${n}` };
  let c = n.replace(/^\/+/, ""),
    l = c.split(/[/?#]/, 1)[0] ?? "";
  if (!/\s/.test(c) && l.includes("@")) return Q(n);
  if (pe(c)) {
    let e = i && r !== null ? `${r.protocol}//${c}` : `https://${c}`;
    try {
      let t = new URL(e);
      e.startsWith("https://") &&
        Y(t.hostname) &&
        ((t.hostname.endsWith(".localhost") &&
          i &&
          r !== null &&
          t.port === r.port &&
          Y(de(r.hostname))) ||
          (e = `http://${e.slice(8)}`));
    } catch {
      return Q(n);
    }
    return { kind: "navigate", url: e };
  }
  return Q(n);
}
export { me as parsePreviewAddress };
