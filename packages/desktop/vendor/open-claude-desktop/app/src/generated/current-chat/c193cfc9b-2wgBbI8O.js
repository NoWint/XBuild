// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { w as o } from "./vendor-frame-foKw4lFA.js";
import { usePageLayer as l } from "../../source-chat-adapters.jsx";
import { U as n } from "./vendor-frame-foKw4lFA.js";
import { W as e } from "./vendor-frame-foKw4lFA.js";
import { I as t } from "./vendor-frame-foKw4lFA.js";
import { Ol as c } from "./shared-frame-DVFSKIcx.js";
import { me as i } from "./vendor-frame-foKw4lFA.js";
import { X as s } from "./shared-frame-DVFSKIcx.js";
import { K as r } from "./vendor-frame-foKw4lFA.js";
import { Y as u } from "./cf35aed38-kaP0vyce.js";
import { ge as a } from "./vendor-frame-foKw4lFA.js";
var d="--cds-page-header-scroll-offset";
var f="--cds-page-header-pinned-height";
var p="mx-auto w-full px-md md:px-8";
var m={content:"max-w-5xl",wide:"max-w-[84rem]"};
var h={none:"pb-0",sm:"pb-2",lg:"pb-6"};
var g={none:"pt-2",sm:"pt-2",lg:"pt-1"};
var _=o(function({children:o,width:_="content",contentGap:v="sm",banner:y,topSentinelRef:b,header:x,className:S,...C},w){let T=x!==!1,E=l(20),D=n(null),O=n(null),k=b??O,[A,j]=e(!1);t(()=>{let e=k.current;if(!e||typeof IntersectionObserver>"u")return;let t=new IntersectionObserver(e=>{let t=e.at(-1);t&&j(!t.isIntersecting)});return t.observe(e),()=>t.disconnect()},[k]);let[M,N]=e(0);t(()=>{let e=D.current;if(!e||typeof ResizeObserver>"u")return;let t=()=>N(e.offsetHeight);t();let n=new((c(e))??ResizeObserver)(t);return n.observe(e),()=>n.disconnect()},[T]);let P=T?M>0?`${M+48}px`:"10rem":"0px",F=T?M>0?`${M}px`:"7rem":"0px";return i("div",{ref:w,"data-cds":"Page","data-width":_,className:s("flex w-full flex-col",S),style:{[d]:P,[f]:F},children:[r("div",{ref:k,className:"h-0"}),T?i("div",{ref:D,className:"sticky top-0 bg-page",style:{zIndex:E},children:[r("div",{className:s(p,m[_],h[v]),children:r(u,{...C})}),r("div",{"aria-hidden":"true","data-cds-part":"fade",className:a("page-fade-t absolute inset-x-0 -bottom-8 h-8 transition-opacity duration-fast",A?"opacity-100":"opacity-0")})]}):null,i("div",{className:s(p,m[_],"flex grow flex-col",g[v]),children:[y?r("div",{className:"pb-6",children:y}):null,o]})]})});

export { _, d, f, p, m, h, g, o, l, n, e, t, c, i, s, r, u, a };
