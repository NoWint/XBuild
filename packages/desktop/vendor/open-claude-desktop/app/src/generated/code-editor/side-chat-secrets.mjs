// Original current secret detector, mask and whole-text redaction.
function k(e) {
  let t,
    n = !1;
  return () => ((n ||= ((t = e()), !0)), t);
}
const xA =
  /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\u2800\uFFFC\u{1D159}\u{13441}\u{13442}\u{16910}\uFDD0-\uFDEF\uFFFE\uFFFF\u{1FFFE}\u{1FFFF}\u{2FFFE}\u{2FFFF}\u{3FFFE}\u{3FFFF}\u{4FFFE}\u{4FFFF}\u{5FFFE}\u{5FFFF}\u{6FFFE}\u{6FFFF}\u{7FFFE}\u{7FFFF}\u{8FFFE}\u{8FFFF}\u{9FFFE}\u{9FFFF}\u{AFFFE}\u{AFFFF}\u{BFFFE}\u{BFFFF}\u{CFFFE}\u{CFFFF}\u{DFFFE}\u{DFFFF}\u{EFFFE}\u{EFFFF}\u{FFFFE}\u{FFFFF}\u{10FFFE}\u{10FFFF}]/u;
const ve = xA,
  E = k;
var os = "(?<![A-Za-z0-9_-])";
var ss = "\\u00A0\\u1680\\u2000-\\u200A\\u202F\\u205F\\u3000";
var cs = `\\t\\v\\f\\r\\n\\u2028\\u2029 ${ss}`;
var ls = `[${cs}]*`;
var us = "-{4,5}";
var ds = `[ \\t${ss}]*`;
var fs = RegExp(`PRIVATE${ls}KEY(?:${ls}BLOCK)?${ds}${us}`);
var ps = RegExp(`${us}${ds}BEGIN[A-Z0-9${cs}]*${fs.source}`);
var ms = RegExp(`${us}${ds}END[A-Z0-9${cs}]*${fs.source}`);
var hs = [
  {
    id: "anthropic",
    regex: RegExp(`${os}sk-ant-[A-Za-z0-9_-]{20,}`),
    trigger: "sk-ant-",
  },
  {
    id: "openai_proj",
    regex: RegExp(`${os}sk-proj-[A-Za-z0-9_-]{20,}`),
    trigger: "sk-proj-",
  },
  {
    id: "openai",
    regex: RegExp(`${os}sk-[A-Za-z0-9]{20,}`),
    trigger: "sk-[A-Za-z0-9]{20}",
  },
  {
    id: "github",
    regex: RegExp(`${os}(?:gh[opsu]_|github_pat_)[A-Za-z0-9_]{20,}`),
    trigger: "gh[opsu]_|github_pat_",
  },
  { id: "aws", regex: RegExp(`${os}AKIA[A-Z0-9]{16}`), trigger: "AKIA" },
  {
    id: "slack",
    regex: RegExp(`${os}xox[abprs]-[A-Za-z0-9-]{10,}`),
    trigger: "xox[abprs]-",
  },
  {
    id: "google",
    regex: RegExp(`${os}AIza[A-Za-z0-9_-]{35}`),
    trigger: "AIza",
  },
  {
    id: "stripe",
    regex: RegExp(`${os}(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}`),
    trigger: "[sr]k_(?:live|test)_[A-Za-z0-9]{20}",
  },
  {
    id: "stripe_webhook",
    regex: RegExp(`${os}whsec_[A-Za-z0-9]{20,}`),
    trigger: "whsec_[A-Za-z0-9]{20}",
  },
  {
    id: "age",
    regex: RegExp(`${os}AGE-SECRET-KEY-1[02-9AC-HJ-NP-Z]{58}`),
    trigger: "AGE-SECRET-KEY-1",
  },
  {
    id: "jwt",
    regex: RegExp(
      `${os}eyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}`,
    ),
    trigger: "\\.eyJ",
  },
  {
    id: "private_key",
    regex: RegExp(
      `${ps.source}[A-Za-z0-9+/=$\\\\\\r\\n\\u2028\\u2029${ss}]{0,5000}?${ms.source}`,
    ),
    trigger: fs.source,
  },
];
var gs = hs.map((e) => `(?:${e.regex.source})`).join("|");
var _s = new RegExp(hs.map((e) => `(?:${e.trigger})`).join("|"));
function vs() {
  return new RegExp(gs, "g");
}
function ys(e) {
  return hs.find((t) => t.regex.test(e));
}
var bs = 262144;
var xs = E(
  () =>
    new RegExp(String.raw`(?![\t\n\r])${ve.source}|[\p{M}\p{Co}\p{Cn}]`, "u"),
);
var Cs = E(() => RegExp(`(?:${xs().source})+`, "gu"));
var ws = /[^\t\n\r\x20-\x7E]/;
var Ts = /[\u0100-\uffff]/;
var Es = 1;
var Ds = Array.from({ length: 4352 }, () => void 0);
var Os = 8;
function ks(e) {
  let t = Ds[e];
  if (t === void 0) {
    t = new Uint8Array(256);
    let n = [];
    for (let t = 0; t < 256; t++) n.push((e << 8) | t);
    let r = e > 255 ? 2 : 1,
      { source: i, flags: a } = xs(),
      o = new RegExp(i, a.includes("g") ? a : `g${a}`);
    for (let e of String.fromCodePoint(...n).matchAll(o))
      t[e.index >> (r - 1)] = Es;
    Ds[e] = t;
  }
  return t;
}
function As(e) {
  let t = ws.exec(e);
  if (t === null) return !1;
  if (!Ts.test(e)) return xs().test(e);
  let n = 0;
  for (let r = t.index; r < e.length; r++) {
    let t = e.codePointAt(r) ?? 0,
      i = Ds[t >> 8];
    if (i === void 0) {
      if (n === Os) return xs().test(e.slice(r));
      ((n += 1), (i = ks(t >> 8)));
    }
    if (i[t & 255] === Es) return !0;
    t > 65535 && r++;
  }
  return !1;
}
var js = RegExp(
  `^(?:${hs
    .filter(({ regex: e }) => e.source.startsWith(os))
    .map(({ regex: e }) => `(?:${e.source.slice(18)})`)
    .concat(ps.source)
    .join("|")})`,
);
var Ms = 512;
var Ns = /^eyJ[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]*){0,2}$/;
var Ps = /[A-Za-z0-9_-]/;
var Fs = /(?:[A-Za-z0-9_]|(?<=[A-Za-z0-9_])-(?=[A-Za-z0-9_]))*/y;
var Is = "\0";
function Ls(e, t) {
  let n = 0,
    r = [],
    i = [],
    a = 0,
    o = 0;
  return {
    shadow: e.replace(Cs(), (s, c) => {
      let l = c - n;
      n += s.length;
      let u =
          t !== void 0 && c > 0 && Ps.test(e[c - 1])
            ? t.slice(l, l + Ms)
            : void 0,
        d =
          u !== void 0 && (js.test(u) || (u.length === Ms && Ns.test(u)))
            ? Is
            : "";
      return (
        (o += d.length),
        r.push(c - a + d.length),
        (a += s.length - d.length),
        i.push(a),
        d
      );
    }),
    edges: o,
    toRaw: (e) => {
      let t = 0,
        n = r.length;
      for (; t < n; ) {
        let i = (t + n) >>> 1;
        r[i] <= e ? (t = i + 1) : (n = i);
      }
      return t === 0 ? e : e + i[t - 1];
    },
  };
}
function Rs(e) {
  if (e.length > 262144) return [];
  let t = [],
    n = (e, n, r) => {
      t.push({ start: e, end: n, patternId: ys(r)?.id ?? "unknown" });
    };
  if (_s.test(e))
    for (let t of e.matchAll(vs())) n(t.index, t.index + t[0].length, t[0]);
  if (As(e)) {
    let t = (t) => {
      let { shadow: r, edges: i, toRaw: a } = Ls(e, t);
      if ((t === void 0 || i !== 0) && _s.test(r))
        for (let e of r.matchAll(vs()))
          n(a(e.index), a(e.index + e[0].length - 1) + 1, e[0]);
      return r;
    };
    t(t());
  }
  t.sort((e, t) => e.start - t.start);
  let r = [];
  for (let e of t) {
    let t = r[r.length - 1];
    t !== void 0 && e.start < t.end
      ? (t.end = Math.max(t.end, e.end))
      : r.push({ ...e });
  }
  for (let [t, n] of r.entries()) {
    if (n.patternId === "private_key") continue;
    Fs.lastIndex = n.end;
    let i = Fs.exec(e)?.[0].length ?? 0;
    n.end = Math.min(n.end + i, r[t + 1]?.start ?? e.length);
  }
  return r.map(({ start: t, end: n, patternId: r }) => ({
    start: t,
    end: n,
    value: e.slice(t, n),
    patternId: r,
  }));
}
var zs = 8;
var Bs = "-----BEGIN";
var Vs = "-----END";
var Hs = /^[^-]*(?:-[^A-Za-z0-9]*)?$/;
function Us(e) {
  let t = xs(),
    n = 0;
  for (let r = 10; r < e.length; ) {
    let i = String.fromCodePoint(e.codePointAt(r) ?? 0);
    if (i === "-") {
      if (((n += 1), n === 5)) return r + 1;
    } else if (!t.test(i)) {
      if (n === 4) return r;
      n = 0;
    }
    r += i.length;
  }
  return -1;
}
function Ws(e) {
  if (e.startsWith(Bs)) {
    let t = e.lastIndexOf(Vs),
      n = t >= 0 && Hs.test(e.slice(t + 8)) ? t : e.length,
      r = Us(e),
      i = r >= 0 && r <= n ? r : 10;
    return (
      Js(e.slice(0, i)) +
      e.slice(i, n).replace(/[^\n]/g, "\u2022") +
      Js(e.slice(n))
    );
  }
  if (!xs().test(e))
    return e.length <= 12
      ? "\u2022".repeat(e.length)
      : e.slice(0, zs) + "\u2022".repeat(e.length - zs);
  let t = xs(),
    n = 0,
    r = 0;
  for (let i = 0; i < e.length; ) {
    let a = String.fromCodePoint(e.codePointAt(i) ?? 0);
    ((i += a.length), t.test(a) || ((n += 1), n === zs && (r = i)));
  }
  return n <= 12
    ? "\u2022".repeat(e.length)
    : e.slice(0, r) + "\u2022".repeat(e.length - r);
}
function Ks(e) {
  let t = Rs(e);
  return t.length > 0 ? qs(e, t) : e;
}
function qs(e, t) {
  if (t.length === 0) return e;
  let n = "",
    r = 0;
  for (let i of t) ((n += e.slice(r, i.start) + Ws(i.value)), (r = i.end));
  return n + e.slice(r);
}
function Js(e) {
  if (e.length <= 262144) return Ks(e);
  let t = [];
  for (let n = 0; n < e.length; n += 253952)
    for (let r of Rs(e.slice(n, n + bs)))
      t.push({
        patternId: r.patternId,
        value: r.value,
        start: n + r.start,
        end: n + r.end,
      });
  t.sort((e, t) => e.start - t.start || e.end - t.end);
  let n = [];
  for (let r of t) {
    let t = n[n.length - 1];
    t !== void 0 && r.start <= t.end
      ? r.end > t.end && ((t.end = r.end), (t.value = e.slice(t.start, t.end)))
      : n.push(r);
  }
  return qs(e, n);
}
export {
  Rs as detectSideChatSecrets,
  Ws as maskSideChatSecret,
  Ks as maskSideChatSecrets,
};
