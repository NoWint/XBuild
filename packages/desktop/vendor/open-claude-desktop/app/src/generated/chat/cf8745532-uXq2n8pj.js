// Extracted from Claude Desktop 2.2553.1 cf8745532-uXq2n8pj.js. Only asset URLs are made relative. Do not edit.
import { jsx as e } from "react/jsx-runtime";
import { ThemePortal as i } from "../../source-chat-adapters.jsx";
import { jsxs as n } from "react/jsx-runtime";
import { X as a } from "./shared-frame-C_2npUJq.js";
import { LocalLink as r } from "../../source-chat-adapters.jsx";
import { classNames as t } from "../../source-chat-adapters.jsx";
var s="relative touch:pointer-events-none";
function l({href:o,title:s,titleEnd:c,description:l,descriptionClassName:u,footer:d,footerClassName:f,overlay:p,className:m,onClick:h}){return e(i,{children:n("div",{"data-grid-cell":"",className:a("group relative flex h-full flex-col gap-xs rounded-card bg-surface-1 p-lg shadow-card-ring [--cds-ring-inner:1px] [--cds-ring-outer:0px] hover:bg-surface-2","transition-transform duration-base ease-out has-[[data-primary]:active]:scale-[0.98] has-[[data-primary]:active]:duration-fast","has-[[data-primary]:focus-visible]:shadow-focus",m),children:[n("div",{className:"flex items-center pr-10",children:[e(r,{href:o,onClick:h,"data-primary":!0,className:t("min-w-0 truncate text-body font-medium text-primary outline-none","after:absolute after:inset-0 after:rounded-card after:content-['']","[scroll-margin-top:var(--list-header-scroll-offset)]","df-link-card"),children:s}),c]}),l&&e("div",{className:a("line-clamp-3 text-body text-secondary",u??"mb-md"),children:l}),e("div",{className:t("flex justify-between text-footnote text-muted",f??"mt-auto"),children:d}),e("div",{className:"absolute right-3 top-3 opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 has-[[aria-expanded=true]]:opacity-100 touch:opacity-100",children:p})]})})}

export { l, s, e, i, n, a, r, t };
