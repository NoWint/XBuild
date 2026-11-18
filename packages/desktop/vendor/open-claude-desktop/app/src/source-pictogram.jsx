import React from "react";
import * as DEFS from "./pictogram-defs.mjs";
import { e as HandBlocks } from "./generated/chat/cbcaf521a-CrWJ5SHy.js";

// CDS Pictogram (2.2553.1 shared-6 ZR, re-exported as St and wrapped by
// shared-7 tV/nV). ZR draws a 500×500 viewBox SVG at GR {sm:64, md:96}: the
// highlight paths take fill-pictogram-highlight-default (KR.default, light/dark
// token in the loaded design system) and the line paths fill currentColor.
// Without an alt it is aria-hidden (YR). The source lazy-loads each def and
// fades it in; the three Customize defs are bundled here (pictogram-defs.mjs),
// so the SVG is present on first paint. Same inline-SVG approach as the
// sidebar empty pictogram (source-sidebar.jsx SourceSidebarEmpty).
export const PICTOGRAM_SIZES = Object.freeze({ sm: 64, md: 96 });

export function SourcePictogram({ name, size = "md", className }) {
  const def = name === "HandBlocks" ? HandBlocks : DEFS[name];
  if (!def) return null;
  const px = typeof size === "number" ? size : PICTOGRAM_SIZES[size];
  return (
    <svg data-cds="Pictogram" data-pictogram={name} width={px} height={px} viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }} className={className} aria-hidden="true">
      {def.highlight.map((d, index) => <path key={`h${index}`} d={d} className="fill-pictogram-highlight-default" />)}
      {def.line.map((d, index) => <path key={`l${index}`} d={d} fill="currentColor" />)}
    </svg>
  );
}
