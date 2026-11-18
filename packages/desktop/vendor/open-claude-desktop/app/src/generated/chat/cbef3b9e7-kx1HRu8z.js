// Extracted from Claude Desktop 2.2553.1 cbef3b9e7-kx1HRu8z.js. Only asset URLs are made relative. Do not edit.
import { jsxs as n } from "react/jsx-runtime";
import { DensityRoot as a } from "../../source-chat-adapters.jsx";
import { classNames as t } from "../../source-chat-adapters.jsx";
import { jsx as e } from "react/jsx-runtime";
import { HostPictogram as r } from "../../source-chat-adapters.jsx";
import { HostButton as i } from "../../source-chat-adapters.jsx";
var o={chats:"ObjectChat",projects:"HandBlocks",artifacts:"HandShapes",locked:"HandLock",error:"ObjectAlert"};
var s=({headline:s,headlineLevel:c=3,description:l,className:u="",variant:d="projects",pictogram:f,illustration:p,hideIllustration:m=!1,align:h="center",ctaLabel:g,onCtaClick:_,ctaDisabled:v=!1,ctaDisabledReason:y,ctaBusy:b=!1})=>{let x=c===2?"h2":"h3";return n(a,{className:t("flex flex-col gap-md whitespace-normal text-body",h==="start"?"items-start pb-12 text-left":"items-center justify-center px-md py-12 text-center",u),children:[!m&&(p??e(r,{name:f??o[d],size:"md",className:"text-primary"})),!!s&&e(x,{className:"max-w-xs font-medium text-secondary",children:s}),!!l&&e("p",{className:"max-w-xs text-footnote text-secondary",children:l}),!!(g&&(_||v))&&e(i,{onClick:_,disabled:v,disabledReason:y,busy:b,children:g})]})};

export { s, o, n, a, t, e, r, i };
