// Original CDS radio-card layout. Radio semantics and focus belong to the local host.
import { forwardRef as J, useId as p, Fragment as ie } from "react";
import { jsx as W, jsxs as K } from "react/jsx-runtime";
export function createPreviewLinkRadio({
  Radio: Ze,
  Indicator: jN,
  useWrap: ay,
  onMouseDown: rs,
}) {
  const X = (...parts) => parts.filter(Boolean).join(" ");
  const PN =
    "cds-reset group/rd flex w-full items-start gap-md rounded-card border bg-surface-1 p-md text-start text-body font-normal text-primary outline-none focus-visible:outline-hidden hover:border-strong focus-visible:shadow-focus data-[checked]:border-accent data-[checked]:bg-[var(--cds-radio-group-card-selected)] data-[checked]:hover:border-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-disabled";
  const FN = J(
    (
      {
        value: e,
        label: t,
        description: n,
        leading: r,
        trailing: i,
        children: a,
        disabled: o,
        className: s,
      },
      c,
    ) => {
      let l = ay(),
        u = p(),
        d = p(),
        f = K(Ze, {
          ref: c,
          value: e,
          disabled: o,
          "aria-labelledby": u,
          "aria-describedby": n ? d : void 0,
          onMouseDown: rs(void 0),
          className: X(PN, s),
          children: [
            W(jN, { topAlign: !0 }),
            r ? W("span", { className: "shrink-0", children: r }) : null,
            K("span", {
              className: "flex min-w-0 flex-1 flex-col gap-xs",
              children: [
                K("span", {
                  className: "flex min-w-0 flex-col",
                  children: [
                    K("span", {
                      className: "flex items-start justify-between gap-sm",
                      children: [
                        W("span", {
                          id: u,
                          className: "min-w-0 font-medium",
                          children: t,
                        }),
                        i
                          ? W("span", { className: "shrink-0", children: i })
                          : null,
                      ],
                    }),
                    n &&
                      W("span", {
                        id: d,
                        className: "text-footnote leading-snug text-muted",
                        children: n,
                      }),
                  ],
                }),
                a,
              ],
            }),
          ],
        });
      return l ? W(ie, { children: f }) : f;
    },
  );
  return FN;
}
