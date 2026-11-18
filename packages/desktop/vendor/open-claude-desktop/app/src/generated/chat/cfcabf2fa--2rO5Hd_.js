// Extracted from Claude Desktop 2.2553.1 cfcabf2fa--2rO5Hd_.js. Only asset URLs are made relative. Do not edit.
import { jsx as n } from "react/jsx-runtime";
import { classNames as r } from "../../source-chat-adapters.jsx";
import { Ow as s } from "./shared-20-BrTrXIRV.js";
import { SourceIcon as i } from "../../source-chat-adapters.jsx";
import { artifactTypeInfo as a } from "../../source-artifact-adapters.jsx";
function f({source:e,icon:t,typeIcon:a,tint:o,iconSize:c,bare:l=!1}){return n("div",{"data-gallery-type-media":l?"":void 0,className:r("flex h-full w-full items-center justify-center",t!==void 0||o!==void 0?s(o==="gray"?void 0:o):l?"text-muted":s(void 0)),children:n(i,{name:a??t??(e==="frame"?"Code":e==="design"?"Palette":"Artifacts"),size:c})})}
function p({item:e,size:t="row"}){return n("div",{className:t==="chip"?"size-6 shrink-0 overflow-hidden rounded-md":"size-9 shrink-0 overflow-hidden rounded-lg",children:n(f,{source:e.source,icon:e.icon,typeIcon:a(e.typeSlug)?.iconName,tint:e.tint,iconSize:t==="chip"?"sm":"md"})})}

export { p, f, n, r, s, i, a };
