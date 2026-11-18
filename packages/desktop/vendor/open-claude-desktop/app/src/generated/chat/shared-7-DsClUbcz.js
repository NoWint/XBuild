// Extracted from Claude Desktop 2.2553.1 shared-7-DsClUbcz.js. Only asset URLs are made relative. Do not edit.
import { forwardRef as f } from "react";
import { useSyncExternalStore as g } from "react";
import { useRef as x } from "react";
import { Wt as Ga } from "./shared-frame-C_2npUJq.js";
import { useState as C } from "react";
import { Q as ka } from "./shared-frame-C_2npUJq.js";
import { flushSync as k } from "react-dom";
import { useEffect as h } from "react";
import { jsxs as j } from "react/jsx-runtime";
import { X as eo } from "./shared-frame-C_2npUJq.js";
import { jsx as O } from "react/jsx-runtime";
import { fd as Pa } from "./shared-frame-C_2npUJq.js";
import { Z as Za } from "./shared-frame-C_2npUJq.js";
import { _i as ao } from "./shared-frame-C_2npUJq.js";
import { Xr as ro } from "./shared-frame-C_2npUJq.js";
import { isValidElement as te } from "react";
import { useLayoutEffect as d } from "react";
import { $ as to } from "./shared-frame-C_2npUJq.js";
import { HostCollapsible as Fa } from "../../source-chat-adapters.jsx";
import { ks as Aa } from "./shared-frame-C_2npUJq.js";
var Bl="rounded-composer";
var Eb="data-find-omitted";
function IS(e){return!te(e)||typeof e.type=="string"?!1:zS(e.type)}
var LS=Symbol.for("react.memo");
var RS=Symbol.for("react.forward_ref");
function zS(e){let t=e;for(let e=0;e<4&&t!=null;e++){if(t.isCdsPictogram===!0)return!0;let e=t;if(e.$$typeof===LS)t=e.type;else if(e.$$typeof===RS)t=e.render;else return!1}return!1}
var BS={glyph:"ml-[6px] compact:ml-[6px] comfortable:ml-[4px]",text:"ml-[4px] compact:ml-[4px] comfortable:ml-[2px]"};
var VS={glyph:"-ml-[6px] compact:-ml-[6px] comfortable:-ml-[4px]",text:"-ml-[4px] compact:-ml-[4px] comfortable:-ml-[2px]"};
var HS={glyph:"-mr-[4px]",text:"-mr-[2px] compact:-mr-[2px] comfortable:-mr-[4px]"};
var US={glyph:"me-[calc(8px-var(--cds-pad-md))] compact:me-[calc(8px-var(--cds-pad-md))] comfortable:me-[calc(4px-var(--cds-pad-md))]",text:"me-[calc(6px-var(--cds-pad-md))] compact:me-[calc(6px-var(--cds-pad-md))] comfortable:me-[calc(5px-var(--cds-pad-md))]"};
var WS={comfortable:"sm",compact:"base"};
var GS=64;
var KS={neutral:"bg-surface-1 text-primary shadow-card-ring [--cds-prose-code-color:var(--cds-text-danger)] [--cds-prose-marker-color:var(--cds-text-secondary)]",warning:"bg-warning text-warning shadow-ring-warning [--cds-prose-code-color:currentColor] [--cds-prose-marker-color:currentColor]",danger:"bg-danger text-danger shadow-ring-danger [--cds-prose-code-color:currentColor] [--cds-prose-marker-color:currentColor]"};
var qS={neutral:"text-secondary",warning:"",danger:""};
var JS={neutral:"Info",warning:"Warning",danger:"Warning"};
function YS({variant:e,icon:t,action:n,actionAlign:r="first-line",details:i,defaultDetailsOpen:a=!1,detailsOpen:o,onDetailsOpenChange:s,onDismiss:c,dismissLabel:l,role:u,composerCalibration:f,className:p,"data-testid":m,children:h}){let g=Za("dismiss","Dismiss"),_=l??g,v=ao(),y={"data-step":ro(v,WS[v])},b=e??"neutral",S=f===!0?"glyph":f===!1?void 0:f,w=S!==void 0,T=t!=null&&typeof t!="boolean",ee=IS(t),E=i!=null&&typeof i!="boolean",D=u??(E?"none":"status"),[k,A]=C(a),[te,ne]=C(!1),re=x(null),ie=x(null),ae=x(null),oe=x(0),se=n!=null&&typeof n!="boolean",ce=!E&&(ee||r==="center"&&!w),le=!E&&!ce&&se,ue=le&&te,de=w&&ue;d(()=>{if((!w||!le)&&(oe.current=0),!le)return;let e=re.current;if(e===null||typeof ResizeObserver>"u")return;let t=()=>{if(de){e.offsetWidth>oe.current+GS&&ne(!1);return}let t=ie.current,n=ae.current;if(t===null||n===null)return;let r=Number.parseFloat(getComputedStyle(t).lineHeight);if(!Number.isFinite(r)||r<=0)return;let i=n.getBoundingClientRect().top-t.getBoundingClientRect().top>r/2;i&&w&&(oe.current=e.offsetWidth),ne(i)};t();let n=new ResizeObserver(t);return n.observe(e),()=>n.disconnect()},[le,w,de]);let fe=o??k,pe=e=>{A(e),s?.(e)},me=E||!ee,he=n?O("span",{ref:ae,...y,className:eo("flex shrink-0 items-center gap-xs",!ue&&"h-[1lh]",de&&"basis-full",!ue&&"-ms-[2px]",de&&S&&VS[S],S!==void 0&&!c&&US[S],!w&&!c&&"-me-[calc(var(--cds-pad-md)-2px)]"),children:n}):null;return j("div",{"data-cds":"Banner","data-icon-layout":me?"first-line":"centered","data-cta-layout":de?"stacked":ue?"wrapped":"inline","data-action-align":ce?"center":"first-line","data-testid":m,role:D==="none"?void 0:D,ref:re,className:eo("flex",me?"items-start":"items-center","gap-xs py-md font-sans text-body font-normal",w?"px-md":"px-lg",ue&&!de&&"pb-lg",w?Bl:"rounded-card",KS[b],p),children:[t!==null&&!de&&O("span",{className:me?`flex min-h-[1lh] shrink-0 items-center ${qS[b]}`:`shrink-0 ${qS[b]}`,children:T?t:O(to,{name:JS[b],size:"auto"})}),E?O("div",{className:eo("flex min-w-0 flex-1 flex-col",S&&BS[S]),children:j(Fa.Root,{className:"contents",open:fe,onOpenChange:pe,children:[j("div",{className:"flex min-w-0 flex-wrap items-start gap-y-sm gap-x-md",children:[O(Fa.Trigger,{render:j("button",{type:"button",className:"cds-reset flex min-w-0 grow select-none items-center gap-x-[2px] border-0 text-start outline-none focus-visible:shadow-focus focus-visible:outline-hidden rounded transition-shadow duration-fast",children:[O("div",{className:"min-w-0",children:h}),O(to,{name:"CaretDown",size:"sm",className:`shrink-0 text-secondary transition-transform ${fe?"rotate-0":"-rotate-90"}`})]})}),he]}),O(Fa.Panel,{className:"w-full text-secondary",children:O("div",{className:"pt-[var(--cds-gap-sm)]",children:i})})]})}):j("div",{className:eo("flex min-w-0 flex-wrap",ce?"items-center":"items-start","gap-y-sm gap-x-md flex-1",de&&"gap-y-xs",S&&BS[S]),children:[O("div",{ref:ie,className:ce?"min-w-[min(20ch,100%)] flex-1":"max-w-full min-w-0 flex-auto",children:h}),he]}),c&&O("span",{...y,className:`${S===void 0?"-me-[calc(var(--cds-pad-md)-2px)]":HS[S]} flex h-[1lh] shrink-0 items-center`,children:O(Aa,{variant:"ghost",iconOnly:!0,icon:"X","aria-label":_,tooltip:!1,onClick:c})})]})}
var BH={default:"[background-image:linear-gradient(120deg,var(--cds-text-primary)_37.5%,color-mix(in_srgb,var(--cds-text-primary)_30%,white)_50%,var(--cds-text-primary)_62.5%)] dark:[background-image:linear-gradient(120deg,var(--cds-text-secondary)_37.5%,var(--cds-text-primary)_50%,var(--cds-text-secondary)_62.5%)] motion-reduce:text-primary dark:motion-reduce:text-secondary",secondary:"[background-image:linear-gradient(120deg,var(--cds-text-secondary)_37.5%,color-mix(in_srgb,var(--cds-text-secondary)_30%,white)_50%,var(--cds-text-secondary)_62.5%)] dark:[background-image:linear-gradient(120deg,var(--cds-text-muted)_37.5%,color-mix(in_srgb,var(--cds-text-muted)_30%,white)_50%,var(--cds-text-muted)_62.5%)] motion-reduce:text-secondary dark:motion-reduce:text-muted",muted:"[background-image:linear-gradient(120deg,var(--cds-text-muted)_37.5%,color-mix(in_srgb,var(--cds-text-muted)_30%,white)_50%,var(--cds-text-muted)_62.5%)] motion-reduce:text-muted"};
var VH="bg-clip-text [-webkit-text-fill-color:transparent] bg-no-repeat [background-size:400%_100%] [background-position:83.333%_0%] animate-[cds-shimmer-text-shine_3s_linear_infinite] motion-reduce:animate-none motion-reduce:bg-none dark:motion-reduce:bg-none motion-reduce:[-webkit-text-fill-color:currentcolor] forced-colors:animate-none forced-colors:bg-none forced-colors:[-webkit-text-fill-color:CanvasText]";
var HH="(-webkit-mask-clip: text) and (-webkit-app-region: drag)";
var UH=()=>typeof CSS<"u"&&typeof CSS.supports=="function"&&CSS.supports(HH);
var WH=()=>void 0;
var GH=()=>WH;
function KH(){return g(GH,UH,()=>!1)}
var qH=new Set(["block","inline-block","flow-root","list-item"]);
var JH=16;
var YH=new Set(["block","flow-root","list-item"]);
var XH=new Set(["contents","inline"]);
var ZH=e=>e.getPropertyValue("-webkit-line-clamp")!=="none";
function QH(e){let t=e.ownerDocument.defaultView;if(!t)return!1;let n=t.getComputedStyle(e);if(!qH.has(n.display)||ZH(n))return!1;let r=e.parentElement;for(let e=0;r&&e<JH;e++){let e=t.getComputedStyle(r);if(ZH(e))return!1;if(!YH.has(e.display)&&!XH.has(e.display))break;r=r.parentElement}return!0}
function $H(e){if(typeof e.getAnimations=="function")return e.getAnimations({subtree:!0}).find(t=>{let n=t.effect;return n?.target===e&&n.pseudoElement==="::after"})}
var eU="relative forced-colors:[-webkit-text-fill-color:CanvasText]";
var tU={default:"[-webkit-text-fill-color:var(--cds-text-primary)] dark:[-webkit-text-fill-color:var(--cds-text-secondary)] [--cds-shimmer-text-peak:color-mix(in_srgb,var(--cds-text-primary)_30%,white)] dark:[--cds-shimmer-text-peak:var(--cds-text-primary)]",secondary:"[-webkit-text-fill-color:var(--cds-text-secondary)] dark:[-webkit-text-fill-color:var(--cds-text-muted)] [--cds-shimmer-text-peak:color-mix(in_srgb,var(--cds-text-secondary)_30%,white)] dark:[--cds-shimmer-text-peak:color-mix(in_srgb,var(--cds-text-muted)_30%,white)]",muted:"[-webkit-text-fill-color:var(--cds-text-muted)] [--cds-shimmer-text-peak:color-mix(in_srgb,var(--cds-text-muted)_30%,white)]"};
var nU={"data-cds-shimmer-clone":"","aria-hidden":!0,[Eb]:"",...Pa(!0)};
var rU=f(function({children:e,active:t=!0,variant:n="default",delay:r,paused:i,className:a,style:o,...s},c){let l=KH(),u=x(null),d=x(null),f=Ga(u,c),[p,m]=C(!0);ka(()=>{let e=u.current;if(!t||!l||!e)return;let n=e.ownerDocument.defaultView?.ResizeObserver;if(!n){m(!1);return}let r=new n(()=>{r.disconnect(),k(()=>m(QH(e)))});return r.observe(e),d.current&&r.observe(d.current),()=>r.disconnect()},[t,l,a]);let g=t&&l&&p,[_,v]=C(0),y=x(null),b=x(null);ka(()=>{if(!g){y.current=null,b.current=null;return}let e=u.current;if(!e)return;let t=d.current,n=b.current;if(n!==null&&t!==null){b.current=null;let e=$H(t);e&&(n.start!==null&&e.playState==="running"?e.startTime=n.start:n.time!==null&&(e.currentTime=n.time))}let r="";for(let n of e.childNodes)n!==t&&(r+=n.textContent??"");if(y.current!==null&&y.current!==r){let e=t?$H(t):void 0,n=e?.startTime,r=e?.currentTime;b.current=e?{start:typeof n=="number"?n:null,time:typeof r=="number"?r:null}:null,v(e=>e+1)}y.current=r}),h(()=>{},[e,g]);let S=t?g?"composited":"fallback":"inactive",w=S==="fallback"?{...r!==void 0&&{animationDelay:`${r}ms`},...i&&{animationPlayState:"paused"}}:S==="composited"?{...r!==void 0&&{"--cds-shimmer-text-delay":`${r}ms`},...i&&{"--cds-shimmer-text-play-state":"paused"}}:{},T=o||Object.keys(w).length>0?{...o,...w}:void 0;return j("span",{...s,ref:f,"data-cds":"ShimmerText","data-shimmering":t?"true":"false",className:S==="inactive"?a:S==="composited"?eo(eU,tU[n],a):eo(VH,BH[n],a),style:T,children:[e,S==="composited"?O("span",{ref:d,...nU,children:e},_):null]})});

export { rU, KH, GH, WH, UH, HH, QH, qH, ZH, JH, YH, XH, $H, eU, tU, VH, BH, nU, Eb, YS, WS, IS, zS, LS, RS, GS, VS, US, Bl, KS, qS, JS, BS, HS, f, g, x, Ga, C, ka, k, h, j, eo, O, Pa, Za, ao, ro, te, d, to, Fa, Aa };
