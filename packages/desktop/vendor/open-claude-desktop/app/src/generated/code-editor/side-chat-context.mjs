// Original wire attachment serializer/parser and Unicode-safe selection limit.
const T = (fn) => {
  let value;
  return () => (value ??= fn());
};
const Nh = T(
  () =>
    /^(?![\n\r\t])[\p{Cc}\p{Default_Ignorable_Code_Point}\uFFF9-\uFFFB\uD800-\uDFFF]$/u,
);
function Ph(e) {
  return Nh().test(e);
}
const pg = /^[\s\u0085\u3002\u3001\uFF1F\uFF01]$/;
const mg = T(() => /^\p{Cf}$/u);
function hg(e) {
  return Ph(e) || mg().test(e);
}
function gg(e, t) {
  let n = e.charCodeAt(t - 1),
    r = e.charCodeAt(t - 2),
    i = n >= 56320 && n <= 57343 && r >= 55296 && r <= 56319;
  return e.slice(t - (i ? 2 : 1), t);
}
function vg(e, t) {
  let n = t + 1;
  for (; /^[\uFEFF\v\f]$/.test(e[n] ?? ""); ) n++;
  if (n >= e.length || /\s/.test(e[n])) return !1;
  let r = t;
  for (; r > 0; ) {
    let t = gg(e, r);
    if (pg.test(t)) return !0;
    if (!hg(t)) return !1;
    r -= t.length;
  }
  return !0;
}
function xg(e) {
  return e.replace(/@/g, (t, n) => (vg(e, n) ? "\uFF20" : t));
}
const n = xg;
const oe = "<!-- attach -->";
const S = /\r\n?|[\n\u2028\u2029]/g;
function C(e, t) {
  if (!e && !t) return oe;
  let r = e?.replace(S, " ");
  for (; r !== void 0 && /-->|\|/.test(r); ) r = r.replace(/-->|\|/g, "");
  return (
    (r = r === void 0 ? void 0 : n(r).trim()),
    `<!-- attach: ${[r, t ? `tab:${t}` : void 0].filter(Boolean).join(" | ")} -->`
  );
}
function w(e) {
  return n(e)
    .split(S)
    .map((e) => `> ${e}`).join(`
`);
}
function A(e, t, n) {
  return `${C(t, n)}\n${w(e)}`;
}
function Se(e, t) {
  return `${A(t)}\n\n${e}`;
}
const Ne =
  /^<!-- attach(?:: (.*?))?(?: \| tab:(\S+))? -->\n((?:>(?: |$).*\n?)+)\n*/gm;
function B(e) {
  if (!e.includes("<!-- attach")) return { snippets: [], rest: e.trim() };
  let t = [];
  return {
    snippets: t,
    rest: e
      .replace(Ne, (e, n, r, i) => {
        let a = i
          .split(
            `
`,
          )
          .map((e) => e.replace(/^> ?/, ""))
          .join(
            `
`,
          )
          .trim();
        return (
          a &&
            t.push({
              text: a,
              label: n?.trim() || void 0,
              terminalTabId: r || void 0,
            }),
          ""
        );
      })
      .trim(),
  };
}
const X9 = 1500;
function Z9(e, t) {
  if (e.length <= t) return e;
  let n = e.charCodeAt(t - 1),
    r = n >= 55296 && n <= 56319 ? t - 1 : t;
  return `${e.slice(0, r)}\u2026`;
}
export {
  Se as sideChatContextQuestion,
  B as parseSideChatQuestion,
  X9 as sideChatContextLimit,
  Z9 as truncateSideChatContext,
};
