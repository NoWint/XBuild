// Original loader table, parsers, caching and comment-token overrides. Host rollout/background/preload adapters are local.
import {
  $ as S,
  A as Te,
  Bt as C,
  E as Ee,
  F as w,
  It as T,
  J as E,
  K as De,
  L as Oe,
  Lt as ke,
  Mt as Ae,
  Nt as D,
  O as je,
  Pt as O,
  Qt as Me,
  R as k,
  S as Ne,
  St as A,
  Yt as Pe,
  Zt as j,
  _ as M,
  _n as Fe,
  _t as Ie,
  a as Le,
  an as Re,
  bn as ze,
  c as Be,
  cn as Ve,
  ct as He,
  d as Ue,
  dn as N,
  dt as We,
  en as Ge,
  ft as P,
  g as Ke,
  gn as qe,
  gt as Je,
  h as Ye,
  hn as F,
  ht as Xe,
  it as I,
  j as Ze,
  l as L,
  ln as R,
  lt as Qe,
  m as $e,
  mn as et,
  mt as tt,
  n as nt,
  nn as rt,
  nt as it,
  o as at,
  on as ot,
  p as st,
  pn as z,
  qt as B,
  rn as ct,
  rt as lt,
  s as ut,
  st as dt,
  t as ft,
  tn as pt,
  tt as V,
  u as mt,
  un as H,
  ut as ht,
  v as gt,
  vn as _t,
  vt,
  xn as yt,
  y as bt,
} from "./c148e7537-Ks6hIVju.js";
import { filenameLanguage as de } from "./filename-language.mjs";
const se = (path) => path.replaceAll("\\", "/").split("/").at(-1);
const h = () => true,
  g = (load) => load(),
  v = (_options, load) => load();
var $n = "__gb__9871662",
  er = new WeakMap();
function tr(e, t) {
  return async () => {
    let n = await e();
    if (!n) return n;
    let r = new w(n.language, [
      n.support,
      n.language.data.of({ commentTokens: t }),
    ]);
    return (er.set(r, n), r);
  };
}
function nr(e) {
  return !e || h($n) !== !1 ? e : (er.get(e) ?? e);
}
function G(e, t) {
  return async () => {
    let n = (await e())[t];
    return n ? new w(Oe.define(n)) : null;
  };
}
function K(e) {
  let t;
  return () => (t ??= e());
}
var rr = K(() =>
  g(() => import("./c2a6d07ee-isRnJR6i.js").then((e) => e.t), []),
);
function q(e, t) {
  return () => rr().then((n) => n.javascript({ jsx: e, typescript: t }));
}
var ir = K(() => g(() => import("./c2a6d07ee-Bmtcsuxi.js"), [])),
  ar = () => ir().then((e) => e.json()),
  or = tr(ar, { line: "//", block: { open: "/*", close: "*/" } }),
  sr = () =>
    g(
      () =>
        import("./c2a6d07ee-BmoyyzZR.js").then((e) => e.i).then((e) => e.css()),
      [],
    ),
  cr = () =>
    g(() => import("./c2a6d07ee-CJYrtwU8.js").then((e) => e.less()), []),
  lr = K(() => g(() => import("./c2a6d07ee-CmWHraz7.js"), []));
function ur(e) {
  return () => lr().then((t) => t.sass({ indented: e }));
}
var dr = () =>
  g(() => import("./c2a6d07ee-BVmagD4f.js").then((e) => e.html()), []);
function fr(e) {
  let { language: t } = e,
    n = N.languageData.of((e, n, r) => {
      let i = Xe(e).resolveInner(n, r);
      for (; !i.type.isTop && i.parent; ) i = i.parent;
      return i.type.prop(We) ? [] : e.facet(t.data);
    });
  return new w(t, [e.support, n]);
}
var pr = () =>
    g(() => import("./c2a6d07ee-CT4tdqVj.js").then((e) => fr(e.vue())), []),
  mr = () =>
    g(
      () =>
        import("./c2a6d07ee-Bv5mkIAc.js").then((e) =>
          e.xml({ autoCloseTags: !1 }),
        ),
      [],
    ),
  hr = () =>
    g(() => import("./c2a6d07ee-CoRn3nLd.js").then((e) => e.markdown()), []),
  gr = () =>
    g(() => import("./c2a6d07ee-Do1nlDpI.js").then((e) => e.python()), []),
  _r = () =>
    g(() => import("./c2a6d07ee-DfkTJPi3.js").then((e) => e.rust()), []),
  vr = () => g(() => import("./c2a6d07ee-CxpQ8UFZ.js").then((e) => e.go()), []),
  yr = () =>
    g(() => import("./c2a6d07ee-H9yR3Q38.js").then((e) => e.java()), []),
  J = () => g(() => import("./c2a6d07ee-DhZWoVCn.js").then((e) => e.cpp()), []),
  br = () =>
    g(() => import("./c2a6d07ee-DljrPHKc.js").then((e) => e.sql()), []),
  xr = () =>
    g(() => import("./c2a6d07ee-CYaTwSDI.js").then((e) => e.php()), []),
  Y = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.i), []),
    "shell",
  ),
  Sr = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.t), []),
    "yaml",
  ),
  Cr = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.n), []),
    "toml",
  ),
  wr = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.g), []),
    "dockerFile",
  ),
  X = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.o), []),
    "ruby",
  ),
  Tr = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.r), []),
    "swift",
  ),
  Er = tr(
    G(
      () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.s), []),
      "protobuf",
    ),
    { line: "//" },
  ),
  Dr = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.d), []),
    "lua",
  ),
  Or = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.p), []),
    "haskell",
  ),
  kr = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.m), []),
    "groovy",
  ),
  Ar = G(
    K(() => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.c), [])),
    "properties",
  ),
  Z = tr(Ar, { line: "#" }),
  jr = tr(Ar, { line: ";" }),
  Mr = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.l), []),
    "pascal",
  ),
  Nr = G(
    K(() => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.h), [])),
    "fortran",
  ),
  Pr = tr(Nr, { line: "!" }),
  Fr = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.a), []),
    "scheme",
  ),
  Ir = G(
    () => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.v), []),
    "commonLisp",
  ),
  Lr = G(() => g(() => import("./c1fe2e782-w4PHC-yL.js"), []), "jinja"),
  Rr = G(() => g(() => import("./cc1a994ce-BAS6XRsu.js"), []), "batch"),
  zr = G(() => g(() => import("./cf3d96880-Dp9-NkOo.js"), []), "hcl"),
  Br = G(() => g(() => import("./ceb04560f-froebiID.js"), []), "graphql"),
  Vr = G(() => g(() => import("./c139416b4-DSag62DK.js"), []), "powershell"),
  Hr = K(() => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.u), []));
function Ur(e) {
  return G(Hr, e);
}
var Wr = Ur("oCaml"),
  Gr = Ur("fSharp"),
  Kr = K(() => g(() => import("./c477e0dc6-2uiBUH57.js").then((e) => e.y), []));
function qr(e) {
  return G(Kr, e);
}
var Jr = qr("csharp"),
  Yr = qr("kotlin"),
  Xr = qr("scala"),
  Zr = qr("objectiveC"),
  Qr = qr("objectiveCpp"),
  $r = qr("dart"),
  ei = qr("shader"),
  ti = {
    js: q(!1, !1),
    javascript: q(!1, !1),
    cjs: q(!1, !1),
    mjs: q(!1, !1),
    jsx: q(!0, !1),
    ts: q(!1, !0),
    cts: q(!1, !0),
    mts: q(!1, !0),
    tsx: q(!0, !0),
    json: ar,
    json5: or,
    jsonc: or,
    jsonl: ar,
    css: sr,
    pcss: sr,
    postcss: sr,
    scss: ur(!1),
    sass: ur(!0),
    less: cr,
    html: dr,
    htm: dr,
    vue: pr,
    svelte: dr,
    astro: dr,
    handlebars: dr,
    hbs: dr,
    xml: mr,
    xsl: mr,
    xslt: mr,
    plist: mr,
    md: hr,
    mdx: hr,
    mdc: hr,
    markdown: hr,
    python: gr,
    py: gr,
    pyi: gr,
    pyw: gr,
    rs: _r,
    sh: Y,
    bash: Y,
    zsh: Y,
    fish: Y,
    makefile: Y,
    mk: Y,
    yml: Sr,
    yaml: Sr,
    go: vr,
    toml: Cr,
    dockerfile: wr,
    rb: X,
    ruby: X,
    gemspec: X,
    podspec: X,
    rake: X,
    ru: X,
    swift: Tr,
    proto: Er,
    lua: Dr,
    luau: Dr,
    sql: br,
    php: xr,
    phtml: xr,
    cs: Jr,
    csharp: Jr,
    csx: Jr,
    c: J,
    h: J,
    cc: J,
    cpp: J,
    cxx: J,
    hh: J,
    hpp: J,
    hxx: J,
    ino: J,
    m: Zr,
    mm: Qr,
    java: yr,
    kt: Yr,
    kts: Yr,
    scala: Xr,
    sc: Xr,
    dart: $r,
    hs: Or,
    groovy: kr,
    gvy: kr,
    nf: kr,
    fs: Gr,
    fsharp: Gr,
    fsi: Gr,
    fsx: Gr,
    ml: Wr,
    mli: Wr,
    properties: Z,
    ini: jr,
    cfg: Z,
    service: Z,
    socket: Z,
    timer: Z,
    device: Z,
    desktop: Z,
    pas: Mr,
    f: Nr,
    f90: Pr,
    f95: Pr,
    for: Nr,
    scm: Fr,
    rkt: Fr,
    lisp: Ir,
    el: Ir,
    bat: Rr,
    cmd: Rr,
    ps1: Vr,
    psm1: Vr,
    psd1: Vr,
    glsl: ei,
    vert: ei,
    frag: ei,
    j2: Lr,
    jinja: Lr,
    jinja2: Lr,
    hcl: zr,
    tf: zr,
    tfvars: zr,
    graphql: Br,
    gql: Br,
  },
  ni = Cr,
  ri = {
    ".dockerignore": ni,
    ".eslintignore": ni,
    ".gitattributes": ni,
    ".gitignore": ni,
    ".npmignore": ni,
    ".prettierignore": ni,
    dockerfile: wr,
    makefile: Y,
    gemfile: X,
    rakefile: X,
  },
  ii = new Set([".coveragerc", ".editorconfig", ".flake8", ".pylintrc"]);
function ai(e) {
  let t = se(e).toLowerCase(),
    n = ii.has(t) ? "properties" : de(t),
    r = n ? oi(ti, n) : void 0;
  if (r) return { key: `ext:${n}`, loader: r };
  let i = t.lastIndexOf("."),
    a = i > 0 ? t.slice(i + 1) : "",
    o = oi(ti, a);
  if (o) return { key: `ext:${a}`, loader: o };
  let s = oi(ri, t);
  return s
    ? { key: `name:${t}`, loader: s }
    : { key: `ext:${a}`, loader: void 0 };
}
function oi(e, t) {
  let n = Object.hasOwn(e, t) ? e[t] : void 0;
  return typeof n == "function" ? n : void 0;
}
var si = new Map(),
  ci = new Map(),
  li = new Map();
function ui(e) {
  let t = li.get(e);
  return (t === void 0 && ((t = K(e)), li.set(e, t)), t);
}
function di(e) {
  let { key: t, loader: n } = ai(e);
  return n ? nr(si.get(t)) : null;
}
async function fi(e) {
  let { key: t, loader: n } = ai(e);
  return n ? nr(await pi(t, n)) : null;
}
function pi(e, t) {
  let n = si.get(e);
  if (n !== void 0) return Promise.resolve(n);
  let r = ci.get(e);
  if (r !== void 0) return r;
  let i = (async () => {
    let n;
    try {
      n = await Promise.resolve().then(() =>
        v({ origin: "background", tag: "files_editor_grammar" }, ui(t)),
      );
    } catch {
      n = null;
    } finally {
      ci.delete(e);
    }
    return (si.set(e, n), n);
  })();
  return (ci.set(e, i), i);
}
function mi(e) {
  fi(e).catch(() => null);
}

export {
  fi as loadEditorLanguage,
  di as cachedEditorLanguage,
  ai as resolveEditorLanguage,
};
