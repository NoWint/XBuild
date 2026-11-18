// Original selected browser-element detail model and visible Unicode escaping.
const e = (() => {
  function k(e) {
    let t,
      n = !1;
    return () => ((n ||= ((t = e()), !0)), t);
  }
  return k;
})();
const { a, o, s, c, l, d } = (() => {
  const I = e;
  const mB = I(
    () =>
      /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff\u{10800}-\u{10fff}\u{1e800}-\u{1efff}]|\p{Default_Ignorable_Code_Point}|\p{Cf}/u,
  );
  const gB = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/;
  const _B = I(
    () =>
      /^[\s\u2800\uFFFC\u{1D159}\u{13441}\u{13442}\u{16910}\p{Default_Ignorable_Code_Point}\p{Cf}\p{Mn}\p{Me}]*$/u,
  );
  const vB = I(
    () =>
      /([0-9#*]\ufe0f\u20e3(?![\p{Mn}\p{Me}]))|[\p{Bidi_Control}\u{E0000}-\u{E01EF}\u0334-\u0338\u20d0-\u20ff\p{Me}]|(?=[\p{Default_Ignorable_Code_Point}\p{Cf}])[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefe\u{10800}-\u{10fff}\u{1e800}-\u{1efff}]|[\p{Default_Ignorable_Code_Point}\p{Cf}]{3,}|[\p{Mn}\p{Me}]{4,}/gu,
  );
  const yB = I(() => /[\p{Default_Ignorable_Code_Point}\p{Cf}]/gu);
  const bB = I(() => RegExp(`(?!\\ufe0f\\u20e3)${yB().source}`, "gu"));
  const xB = 16;
  const SB =
    "(?:[^\\P{Zs} ]|[\\u2800\\uFFFC\\u{1D159}\\u{13441}\\u{13442}\\u{16910}])";
  const CB = I(() =>
    RegExp(
      `${SB}(?:[\\t \\p{Default_Ignorable_Code_Point}\\p{Cf}\\p{Mn}\\p{Me}]*${SB}){2,}[\\p{Mn}\\p{Me}]*`,
      "gu",
    ),
  );
  const wB = I(
    () =>
      /[^\s\u2800\uFFFC\u{1D159}\u{13441}\u{13442}\u{16910}\p{Default_Ignorable_Code_Point}\p{Cf}\p{Mn}\p{Me}]/u,
  );
  const TB = /[^\n\r\u0085\u2028\u2029]+/g;
  function EB(e) {
    return wB().test(e)
      ? e.replace(CB(), (e) =>
          Array.from(e, (e) => (e === " " || e === "	" ? e : MB(e))).join(""),
        )
      : e;
  }
  function DB(e) {
    let t = e.replace(vB(), (e, t) => t ?? MB(e));
    return (
      (t.match(bB())?.length ?? 0) > xB ? t.replace(bB(), MB) : t
    ).replace(TB, EB);
  }
  function MB(e) {
    return Array.from(
      e,
      (e) =>
        `[U+${e.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}]`,
    ).join("");
  }
  return { a: _B, o: MB, s: mB, c: gB, l: yB, d: DB };
})();
const He = /\r\n|[\r\u0085\u2028\u2029]/g;
const Ue = new RegExp(c.source, "g");
function We(e) {
  return e
    .split(
      `
`,
    )
    .map((e) => (a().test(e) ? "" : e))
    .join(
      `
`,
    )
    .replace(
      /\n{3,}/g,
      `

`,
    );
}
function Ge(e) {
  let t = e.replace(
      He,
      `
`,
    ),
    n = d(t);
  return n !== t || s().test(t.replace(l(), "").replace(/[\t\n]/g, ""))
    ? { text: We(n.replace(Ue, o)), escaped: !0 }
    : { text: We(t), escaped: !1 };
}
const Je = 1024;
const Ye = 8;
const Xe = " > ";
const Ze = 2048;
const O = 64;
const Qe = 32768;
function k(e, t = Ze) {
  return e.length > t ? `${e.slice(0, t)}\u2026` : e;
}
function $e(e) {
  if (e.length <= Qe) return { id: "raw", kind: "code", value: e };
  let t = Math.floor(Qe / 4),
    n = 24576;
  return {
    id: "raw",
    kind: "code",
    value: e.slice(0, n),
    cut: { omitted: e.length - n - t, tail: e.slice(-8192) },
  };
}
function et(e) {
  let t = e.slice(0, O).map(([e, t]) => [k(e, 256), k(t)]);
  return e.length > O ? [...t, ["\u2026", `+${e.length - O}`]] : t;
}
function tt(e) {
  if (e.component) {
    let {
      name: t,
      owners: n,
      props: r,
      definedIn: i,
      renderedAt: a,
    } = e.component;
    return {
      name: k(t, Je),
      owners: n
        .map((e) => e.trim())
        .filter((e) => e.length > 0)
        .slice(0, Ye)
        .map((e) => k(e, Je)),
      ...(r && Object.keys(r).length > 0 ? { props: r } : {}),
      ...(i ? { definedIn: k(i) } : {}),
      ...(a ? { renderedAt: k(a) } : {}),
    };
  }
  let t = k(e.reactComponent ?? "", Je);
  if (!t) return null;
  let n = t.lastIndexOf(" (in "),
    r = n > 0 && t.endsWith(")") ? t.slice(n + 5, -1) : null,
    i =
      r
        ?.split(Xe)
        .map((e) => e.trim())
        .filter((e) => e.length > 0) ?? [];
  return {
    name: r === null ? t : t.slice(0, n),
    owners: i,
    ...(e.reactProps && Object.keys(e.reactProps).length > 0
      ? { props: e.reactProps }
      : {}),
  };
}
function nt(e, t, n) {
  if (n) return `<${n.name} />`;
  let r = t
    .slice(0, 2)
    .map((e) => k(e, 128))
    .join(" ");
  return r ? `<${k(e, 64)} class="${r}" />` : `<${k(e, 64)} />`;
}
function rt(e) {
  return Object.entries(e).map(([e, t]) => [
    e,
    typeof t == "string" ? t : (JSON.stringify(t) ?? String(t)),
  ]);
}
function it(e) {
  return Object.entries(e).map(([e, t]) => [e, String(t)]);
}
function at(e, t = (e) => e) {
  let n = (e, n) => k(t(e), n),
    r = [],
    { component: i } = e,
    a = nt(t(e.tagName), e.classes.map(t), i);
  (r.push({ id: "element", kind: "text", value: a }),
    i &&
      (r.push({ id: "component", kind: "text", value: k(i.name) }),
      i.props &&
        Object.keys(i.props).length > 0 &&
        r.push({
          id: "props",
          kind: "entries",
          entries: et(rt(i.props).map(([e, n]) => [t(e), t(n)])),
        })),
    e.source && r.push({ id: "source", kind: "text", value: n(e.source) }));
  let o = e.source?.replace(/(?::\d+){1,2}$/, ""),
    s = i?.definedIn && i.definedIn !== o ? i.definedIn : void 0;
  (s && r.push({ id: "definedIn", kind: "text", value: k(s) }),
    i?.renderedAt &&
      r.push({ id: "renderedAt", kind: "text", value: k(i.renderedAt) }));
  let c = n(e.text ?? "");
  c && r.push({ id: "text", kind: "text", value: c });
  let l = [
    ...(e.id ? [["id", e.id]] : []),
    ...(e.classes.length > 0 ? [["class", e.classes.join(" ")]] : []),
    ...Object.entries(e.attributes ?? {}).map(([e, t]) => [e, String(t)]),
  ].map(([e, n]) => [t(e), t(n)]);
  (l.length > 0 &&
    r.push({ id: "attributes", kind: "entries", entries: et(l) }),
    e.path && r.push({ id: "path", kind: "code", value: n(e.path) }),
    e.styles &&
      Object.keys(e.styles).length > 0 &&
      r.push({
        id: "styles",
        kind: "entries",
        entries: et(it(e.styles).map(([e, n]) => [t(e), t(n)])),
      }),
    e.html && r.push({ id: "html", kind: "code", value: n(e.html) }),
    e.siblings &&
      r.push({ id: "siblings", kind: "code", value: n(e.siblings) }));
  let u = e.raw ? $e(t(e.raw)) : void 0;
  return (
    u && r.push(u),
    {
      title: a,
      ...(u?.kind === "code" && u.cut ? { partial: !0 } : {}),
      component: i
        ? {
            name: k(i.name),
            owners: i.owners.map((e) => k(e)),
            ...(s ? { definedIn: k(s) } : {}),
            ...(i.renderedAt ? { renderedAt: k(i.renderedAt) } : {}),
          }
        : null,
      hasScreenshot: e.hasScreenshot,
      sections: r,
    }
  );
}
function ot(e, t) {
  let n = e.component
    ? {
        name: t(e.component.name),
        owners: e.component.owners.map(t),
        ...(e.component.definedIn
          ? { definedIn: t(e.component.definedIn) }
          : {}),
        ...(e.component.renderedAt
          ? { renderedAt: t(e.component.renderedAt) }
          : {}),
      }
    : null;
  return {
    title: t(e.title),
    hasScreenshot: e.hasScreenshot,
    ...(e.unsafeDisplay ? { unsafeDisplay: !0 } : {}),
    ...(e.partial ? { partial: !0 } : {}),
    ...(e.overflow === void 0 ? {} : { overflow: e.overflow }),
    ...(e.simulator ? { simulator: Gt(e.simulator, t) } : {}),
    ...(e.note === void 0 ? {} : { note: t(e.note) }),
    ...(e.sentNote === void 0 ? {} : { sentNote: e.sentNote }),
    component: n,
    sections: e.sections.map((e) =>
      e.kind === "entries"
        ? { ...e, entries: e.entries.map(([e, n]) => [t(e), t(n)]) }
        : e.kind === "code" && e.cut
          ? { ...e, value: t(e.value), cut: { ...e.cut, tail: t(e.cut.tail) } }
          : { ...e, value: t(e.value) },
    ),
  };
}
function st(e) {
  let t = !1,
    n = ot(
      at({
        tagName: e.tagName,
        classes: e.classes,
        id: e.id,
        attributes: e.attributes,
        hasScreenshot: !!e.screenshot,
        component: tt(e),
        text: e.innerText?.slice(0, 200),
        path: e.parentPath,
        styles: e.computedStyles,
        source: e.sourceFile,
        html: e.outerHTML,
        siblings: e.siblingHTML,
      }),
      (e) => {
        let n = Ge(e);
        return (n.escaped && (t = !0), n.text);
      },
    );
  return t ? { ...n, unsafeDisplay: !0 } : n;
}
function Gt(e, t) {
  let n = (e) => (e === void 0 ? void 0 : t(e));
  return {
    ...e,
    device: t(e.device),
    path: e.path.map(t),
    type: n(e.type),
    label: n(e.label),
    identifier: n(e.identifier),
    value: n(e.value),
    title: n(e.title),
    placeholder: n(e.placeholder),
    help: n(e.help),
    roleDescription: n(e.roleDescription),
    subrole: n(e.subrole),
    ...(e.traits ? { traits: e.traits.map(t) } : {}),
    ...(e.customActions ? { customActions: e.customActions.map(t) } : {}),
  };
}
export { st as selectedElementView };
