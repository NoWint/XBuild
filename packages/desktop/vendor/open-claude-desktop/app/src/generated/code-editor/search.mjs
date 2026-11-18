// Original search engine; desktop-wide dependencies reduced to their exact pure bindings.
const le = [
  ["\u2018", "'"],
  ["\u2019", "'"],
  ["\u201C", '"'],
  ["\u201D", '"'],
];
const At = le;
const Pi = /[\u0130\u03a3\ud800-\udfff]/;
const Fi = /[^\u0130\u03a3\ud800-\udfff]+/y;
function Ii(e) {
  let t = e;
  for (let [e, n] of At) t = t.replaceAll(e, n);
  return t;
}
function G(e) {
  let t = "",
    n = 0,
    r = e.search(Pi);
  for (; r !== -1 && r < e.length; ) {
    let i = e.charCodeAt(r),
      a = r + 1;
    if (i === 304 || i === 931) t += e.slice(n, r).toLowerCase() + Li(e[r]);
    else {
      for (; a < e.length && (e.charCodeAt(a) & 63488) == 55296; ) a++;
      t += e.slice(n, r).toLowerCase() + e.slice(r, a);
    }
    ((n = a), (Fi.lastIndex = a), (r = Fi.test(e) ? Fi.lastIndex : a));
  }
  let i = n === 0 ? e.toLowerCase() : t + e.slice(n).toLowerCase();
  return Ii(i.length === e.length ? i : Ri(e));
}
function Li(e) {
  let t = e.toLowerCase();
  return t.length === 1 ? t : e;
}
function Ri(e) {
  let t = "";
  for (let n = 0; n < e.length; n++) t += Li(e[n]);
  return t;
}
function _f(e) {
  return e.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}
const e = _f,
  t = G;
var n = 1e6;
function r(e, n) {
  let r = t(n);
  if (
    r.length === 0 ||
    r.includes(`
`)
  )
    return [];
  let i = [],
    a = 1,
    o = e.indexOf(`
`),
    s = e.indexOf(r);
  for (; s !== -1 && i.length < 1e6; ) {
    for (; o !== -1 && o < s; )
      (a++,
        (o = e.indexOf(
          `
`,
          o + 1,
        )));
    (i.push(a), (s = e.indexOf(r, s + r.length)));
  }
  return i;
}
var i = { matchCase: !1, wholeWord: !1, regexp: !1 },
  a = 1e3,
  o = 250;
function s(e, t) {
  return e.isRegExp === !0 && t > a;
}
function c(e, t = () => performance.now()) {
  if (e.isRegExp !== !0) return () => !1;
  let n = t() + o;
  return () => t() >= n;
}
var l = "[\\p{L}\\p{N}_]",
  u = /[\p{L}\p{N}_]/u;
function d(e, t) {
  return (n) => {
    let r = t(n),
      i = [],
      a = r.indexOf(e);
    for (; a !== -1; )
      (i.push([a, a + e.length]), (a = r.indexOf(e, a + e.length)));
    return i;
  };
}
function f(t, n) {
  let r = n.matchCase ? "gu" : "giu",
    i = n.regexp ? t : e(t);
  try {
    new RegExp(i, r);
  } catch {
    return null;
  }
  if (n.wholeWord) {
    let e = [...t],
      r = (e) => n.regexp || (e !== void 0 && u.test(e)),
      a = r(e[0]) ? `(?<!${l})` : "",
      o = r(e.at(-1)) ? `(?!${l})` : "";
    i = `${a}(?:${i})${o}`;
  }
  return new RegExp(i, r);
}
function p(e, n) {
  if (
    e.length === 0 ||
    (!n.regexp &&
      e.includes(`
`))
  )
    return null;
  if (!n.regexp && !n.wholeWord)
    return n.matchCase ? d(e, (e) => e) : d(t(e), t);
  let r = f(e, n);
  if (r === null) return null;
  let i = (e) => {
    let t = [];
    if (s(i, e.length)) return t;
    r.lastIndex = 0;
    for (let n = r.exec(e); n !== null; n = r.exec(e))
      n[0].length === 0
        ? (r.lastIndex += (e.codePointAt(n.index) ?? 0) > 65535 ? 2 : 1)
        : t.push([n.index, n.index + n[0].length]);
    return t;
  };
  return (n.regexp && (i.isRegExp = !0), i);
}
function m(e, t, r, i) {
  if (r !== void 0 && r.resume === void 0) return r;
  let a = r?.lines.slice() ?? [],
    o = c(t, i),
    l = r?.hasLongLines ?? !1,
    { from: u, line: d } = r?.resume ?? { from: 0, line: 1 };
  for (; u <= e.length && a.length < 1e6; ) {
    if (o()) return { lines: a, hasLongLines: l, resume: { from: u, line: d } };
    let r = e.indexOf(
        `
`,
        u,
      ),
      i = r === -1 ? e.length : r,
      c = e.slice(u, i > u && e[i - 1] === "\r" ? i - 1 : i);
    l ||= s(t, c.length);
    let f = Math.min(t(c).length, n - a.length);
    for (let e = 0; e < f; e++) a.push(d);
    (d++, (u = i + 1));
  }
  return { lines: a, hasLongLines: l };
}
function h(e, t, n) {
  if (e.length === 0) return -1;
  let r = 0,
    i = e.length;
  for (; r < i; ) {
    let a = (r + i) >>> 1;
    (n === 1 ? e[a] < t : e[a] <= t) ? (r = a + 1) : (i = a);
  }
  return n === 1 ? (r < e.length ? r : 0) : r > 0 ? r - 1 : e.length - 1;
}
function g(e, t) {
  let n = t;
  for (; n > 0 && e[n - 1] === e[t]; ) n--;
  return t - n;
}
function _(e, t) {
  return e === t
    ? !0
    : !e.includes("\r") && !t.includes("\r")
      ? !1
      : e.replace(
          /\r\n?/g,
          `
`,
        ) ===
        t.replace(
          /\r\n?/g,
          `
`,
        );
}
function v(e) {
  let t = 0,
    n = e.indexOf(`\r
`);
  for (; n !== -1; )
    ((t += 1),
      (n = e.indexOf(
        `\r
`,
        n + 2,
      )));
  return e.length - t;
}
var y = 13,
  b = 10;
function x(e, t) {
  return e.replace(/\r\n|\r|\n/g, t);
}
function S(e) {
  if (!e.includes("\r"))
    return {
      text: e,
      lineBreak: `
`,
    };
  let t = 0,
    n = 0,
    r = 0;
  for (let i = 0; i < e.length; i += 1) {
    let a = e.charCodeAt(i);
    a === y
      ? e.charCodeAt(i + 1) === b
        ? ((r += 1), (i += 1))
        : (t += 1)
      : a === b && (n += 1);
  }
  let i =
    t + r > (t + n + r) / 2
      ? `\r
`
      : `
`;
  return {
    text: (
      i ===
      `\r
`
        ? t + n === 0
        : t + r === 0
    )
      ? e
      : x(e, i),
    lineBreak: i,
  };
}
export {
  i as defaultSearchOptions,
  n as searchLimit,
  p as compileSearch,
  m as scanSearch,
  h as searchIndexFromLine,
  s as skipsLongLine,
  G as normalizeSearchText,
};
