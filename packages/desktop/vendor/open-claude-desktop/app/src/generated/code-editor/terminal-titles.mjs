// Original running-command / shell-title tracking for terminal tabs (OSC 133 C cmdline_url, OSC 0/2 titles).
// Rollout gates are on locally. The host supplies the store factory; the text sanitizer keeps its original
// control/invisible-character, mark and whitespace rules but not the long combining-run cap.
export function createTerminalTitles({ create: ee }) {
  const i = () => true,
    f = () => "on";
  const { o, s, c } = (() => {
    const le = (make) => {
      let value;
      return () => (value ??= make());
    };
    const QC = le(
      () =>
        /(?![\t\n\r\u200C\u200D])[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\u034F\u115F\u1160\u3164\uFE00-\uFE0F\uFFA0\u{E0100}-\u{E01EF}]/gu,
    );
    const tw = String.raw`\u2800\uFFFC\u{1D159}\u{13441}\u{13442}\u{16910}`;
    const nw = RegExp(`[\\s${tw}]+`, "gu");
    const rw = le(() =>
      RegExp(`(^|[\\s${tw}])[\\p{Mn}\\p{Me}\\u200C\\u200D]+`, "gu"),
    );
    function bw(e) {
      return e.replace(QC(), "");
    }
    function Ew(e, t) {
      return Array.from(e.replace(/\p{Cs}/gu, ""))
        .slice(0, t)
        .join("");
    }
    const vw = 4e3;
    function gw(e) {
      return e
        .replace(/[\n\r\u2028\u2029]/g, " ")
        .replace(rw(), "$1")
        .replace(nw, " ")
        .trim();
    }
    function Tw(e, t) {
      return gw(t(e.slice(0, vw)).replace(/\p{Cs}/gu, ""));
    }
    const Sw = (e) => Tw(e, bw);
    return {
      o: Sw,
      s: Ew,
      c: (e) =>
        Sw(e)
          .replace(/[\u200C\u200D]/g, "")
          .trim(),
    };
  })();
  const R = "__gb__736896549";
  const z = 133;
  const B = "cmdline_url=";
  const V = 200;
  const le = /^(?:\S+:\s?)?(\S*[/\\]\S*)$/;
  const H = 500;
  const U = /^[0-9A-Fa-f]{2}$/;
  const W = ee(() => ({ byPtyKey: {} }));
  const G = new Map();
  function ue(e, t) {
    let n = e.byPtyKey[t];
    return n?.command ?? n?.reported;
  }
  function de(e) {
    return (
      le
        .exec(e)?.[1]
        ?.split(/[/\\]/)
        .findLast((e) => e !== "") ?? e
    );
  }
  function fe() {
    return f(R) !== "off";
  }
  function K(e) {
    (clearTimeout(G.get(e)), G.delete(e));
  }
  function q(e) {
    (K(e),
      W.setState((t) => {
        if (!(e in t.byPtyKey)) return t;
        let { [e]: n, ...r } = t.byPtyKey;
        return { byPtyKey: r };
      }));
  }
  function J(e, t) {
    W.setState((n) => {
      let r = n.byPtyKey[e],
        i = { ...r, ...t };
      return i.reported === r?.reported && i.command === r?.command
        ? n
        : { byPtyKey: { ...n.byPtyKey, [e]: i } };
    });
  }
  function Y(e) {
    let t = s(o(e), V).trim();
    return c(t) === "" ? void 0 : t;
  }
  const pe =
    /^(?:(?:Administrator: )?\S+|(?:[^\\/]+: )?[A-Za-z]:[\\/].+)\.exe$/i;
  function me(e) {
    let t = Y(e);
    return t !== void 0 && pe.test(t) ? void 0 : t;
  }
  function he(e) {
    let t = e.find((e) => e.startsWith(B))?.slice(12, 2412);
    if (!t) return;
    let n = [],
      r = new TextEncoder();
    for (let e = 0; e < t.length; ) {
      let i = t.slice(e + 1, e + 3);
      if (t[e] === "%" && U.test(i)) (n.push(Number.parseInt(i, 16)), (e += 3));
      else {
        let i = String.fromCodePoint(t.codePointAt(e) ?? 0);
        (n.push(...r.encode(i)), (e += i.length));
      }
    }
    return Y(new TextDecoder().decode(new Uint8Array(n)));
  }
  function ge(e, t) {
    q(t);
    let n = () => {
      let e = i(R) !== !1;
      return (e || q(t), e);
    };
    (e.onTitleChange((e) => {
      n() && J(t, { reported: me(e) });
    }),
      e.parser.registerOscHandler(z, (e) => {
        let [r, ...i] = e.split(";");
        if ((r !== "A" && r !== "C" && r !== "D") || !n()) return !1;
        K(t);
        let a = r === "C" ? he(i) : void 0;
        return (
          a === void 0
            ? J(t, { command: a })
            : G.set(
                t,
                setTimeout(() => {
                  (G.delete(t), J(t, { command: a }));
                }, H),
              ),
          !1
        );
      }));
  }
  return {
    store: W,
    install: ge,
    value: ue,
    description: de,
    forget: q,
    enabled: fe,
  };
}
