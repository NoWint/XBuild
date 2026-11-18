// Original URL copy hook: website validation, clipboard result and generation-scoped feedback.
import { useEffect as t, useRef as a } from "react";
export function createPreviewCopyUrl({
  useIntl: Oe,
  useToasts: re,
  useOwnerWindow: we,
  useFeature: qt,
  useStable: g,
  writeClipboard: B,
  previewApi: S,
}) {
  const Ai = "__gb__110515556";
  function ji(e) {
    try {
      let { protocol: t } = new URL(e);
      return t === "http:" || t === "https:";
    } catch {
      return !1;
    }
  }
  function Mi(e, n) {
    let r = Oe(),
      i = re(),
      o = we(),
      s = qt(Ai),
      c = a(0);
    t(
      () => () => {
        c.current += 1;
      },
      [e],
    );
    let l = g(() => {
        if (!e) return;
        c.current += 1;
        let t = c.current,
          a = n;
        if (a !== null && !ji(a)) {
          i?.addInfo(
            r.formatMessage({
              defaultMessage: "This only works for websites.",
              id: "v/N4TlfEs/",
            }),
          );
          return;
        }
        (async () => {
          if (a === null)
            throw Ni(
              Error("The pane holds no address."),
              "The pane holds no address.",
              "literal",
            );
          let e = await B(o, a);
          if (e !== "written") throw Error(`The clipboard write was ${e}.`);
        })().then(
          () => {
            c.current === t &&
              i?.addSuccess(
                r.formatMessage({
                  defaultMessage: "URL copied to clipboard.",
                  id: "PsIG0LbAxt",
                }),
              );
          },
          (e) => {
            c.current === t &&
              i?.addError(
                r.formatMessage({
                  defaultMessage: "Couldn\u2019t copy the URL. Try again.",
                  id: "kADYN+9Tu7",
                }),
                { error: e, messageForLogging: "preview_copy_url_failed" },
              );
          },
        );
      }),
      u = S?.getPreviewUrl !== void 0 && S.onPreviewUrlChanged !== void 0;
    return s && u ? l : void 0;
  }
  function Ni(e, t, n) {
    try {
      Object.defineProperty(e, Symbol.for("ant.o11y.errorText"), {
        value: { text: t, kind: n },
        enumerable: !1,
        writable: !1,
        configurable: !0,
      });
    } catch {}
    return e;
  }
  return Mi;
}
