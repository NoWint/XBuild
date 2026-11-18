// Extracted from Claude Desktop 2.2553.1 c193cfc9b-B8oGoJPG.js. Only asset URLs are made relative. Do not edit.
import { forwardRef as e } from "react";
import { usePageLayer as s } from "../../source-chat-adapters.jsx";
import { useRef as n } from "react";
import { useState as r } from "react";
import { useEffect as t } from "react";
import { jsxs as o } from "react/jsx-runtime";
import { X as c } from "./shared-frame-C_2npUJq.js";
import { jsx as i } from "react/jsx-runtime";
import { q as l } from "./cf35aed38-CgXOe11O.js";
import { classNames as a } from "../../source-chat-adapters.jsx";
var u="--cds-page-header-scroll-offset";
var d="--cds-page-header-pinned-height";
var f="mx-auto w-full px-md md:px-8";
var p={content:"max-w-4xl",wide:"max-w-[84rem]"};
var m={none:"pb-0",sm:"pb-2",lg:"pb-6"};
var h={none:"pt-2",sm:"pt-2",lg:"pt-1"};
var g=e(function({children:e,width:g="content",contentGap:_="sm",banner:v,topSentinelRef:y,header:b,className:x,...S},C){let w=b!==!1,T=s(20),E=n(null),D=n(null),O=y??D,[k,A]=r(!1);t(()=>{let e=O.current;if(!e||typeof IntersectionObserver>"u")return;let t=new IntersectionObserver(([e])=>{e&&A(!e.isIntersecting)});return t.observe(e),()=>t.disconnect()},[O]);let[j,M]=r(0);t(()=>{let e=E.current;if(!e||typeof ResizeObserver>"u")return;let t=()=>M(e.offsetHeight);t();let n=new ResizeObserver(t);return n.observe(e),()=>n.disconnect()},[w]);let N=w?j>0?`${j+48}px`:"10rem":"0px",P=w?j>0?`${j}px`:"7rem":"0px";return o("div",{ref:C,"data-cds":"Page","data-width":g,className:c("flex w-full flex-col",x),style:{[u]:N,[d]:P},children:[i("div",{ref:O,className:"h-0"}),w?o("div",{ref:E,className:"sticky top-0 bg-page",style:{zIndex:T},children:[i("div",{className:c(f,p[g],m[_]),children:i(l,{...S})}),i("div",{"aria-hidden":"true","data-cds-part":"fade",className:a("page-fade-t absolute inset-x-0 -bottom-8 h-8 transition-opacity duration-fast",k?"opacity-100":"opacity-0")})]}):null,o("div",{className:c(f,p[g],"flex grow flex-col",h[_]),children:[v?i("div",{className:"pb-6",children:v}):null,e]})]})});

export { g, u, d, f, p, m, h, e, s, n, r, t, o, c, i, l, a };
