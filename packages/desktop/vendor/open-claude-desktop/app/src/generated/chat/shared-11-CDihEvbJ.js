// Extracted from Claude Desktop 2.2553.1 shared-11-CDihEvbJ.js. Only asset URLs are made relative. Do not edit.
import { forwardRef as f } from "react";
import { useState as O } from "react";
import { useCallback as N } from "react";
import { useMemo as D } from "react";
import { Children as L } from "react";
import { isValidElement as H } from "react";
import { useContext as x } from "react";
import { $c as Oo } from "./shared-8-B5xbG2px.js";
import { jsx as F } from "react/jsx-runtime";
import { X as aa } from "./shared-frame-C_2npUJq.js";
import { Xc as So } from "./shared-8-B5xbG2px.js";
import { Attachments as Ca } from "../../source-chat-adapters.jsx";
import { el as Ua } from "./shared-8-B5xbG2px.js";
import { createContext as k } from "react";
import { Q as xi } from "./shared-frame-C_2npUJq.js";
import { flushSync as I } from "react-dom";
import { jsxs as B } from "react/jsx-runtime";
import { fd as Ti } from "./shared-frame-C_2npUJq.js";
import { memo as p } from "react";
import { Fragment as M } from "react";
import { classNames as R } from "../../source-chat-adapters.jsx";
import { useRef as E } from "react";
import { qr as Bi } from "./shared-frame-C_2npUJq.js";
import { Es as Ji } from "./shared-frame-C_2npUJq.js";
import { Uc as ao } from "./shared-8-B5xbG2px.js";
import { Gc as jo } from "./shared-8-B5xbG2px.js";
import { useEffect as m } from "react";
import { Qc as vo } from "./shared-8-B5xbG2px.js";
import { Bt as na } from "./shared-frame-C_2npUJq.js";
import { Yi as Hi } from "./shared-frame-C_2npUJq.js";
import { vl as eo } from "./shared-8-B5xbG2px.js";
import { useAttachmentAnchor as ka } from "../../source-chat-adapters.jsx";
import { gd as Ii } from "./shared-frame-C_2npUJq.js";
import { Z as Qi } from "./shared-frame-C_2npUJq.js";
import { Hc as ko } from "./shared-8-B5xbG2px.js";
import { Fragment as A } from "react";
import { Presence as rr } from "../../source-chat-adapters.jsx";
import { AttachmentAnchorContext as ja } from "../../source-chat-adapters.jsx";
import { Wc as oo } from "./shared-8-B5xbG2px.js";
import { rl as Na } from "./shared-8-B5xbG2px.js";
import { tl as qa } from "./shared-8-B5xbG2px.js";
import { Tl as Fa } from "./shared-8-B5xbG2px.js";
import { createPortal as z } from "react-dom";
import { ThemePortal as Yi } from "../../source-chat-adapters.jsx";
import { Qc as Vi } from "./shared-frame-C_2npUJq.js";
import { SourceIcon as oa } from "../../source-chat-adapters.jsx";
function el(e){return e!=null&&typeof e!="boolean"}
var nl="motion-safe:animate-[cds-grid-rows-in_0.3s_cubic-bezier(0.25,0.1,0.35,1)]";
var rl="motion-safe:animate-[cds-drop-ring-in_0.15s_cubic-bezier(0.215,0.61,0.355,1)]";
var il="motion-safe:animate-[cds-fade-in_0.15s_cubic-bezier(0.215,0.61,0.355,1)]";
var al="motion-safe:animate-[cds-fade-in_0.2s_cubic-bezier(0.215,0.61,0.355,1)_0.08s_backwards]";
var ol="motion-safe:animate-[cds-drop-icon-rise_0.22s_cubic-bezier(0.215,0.61,0.355,1)_var(--rise-delay,0ms)_backwards]";
var sl="col-start-1 row-start-1 flex cursor-default items-center transition-[opacity,visibility] duration-fast";
var cl="pointer-events-none invisible opacity-0";
var pl=k(!1);
function ml(){return x(pl)}
var hl="bg-surface-3";
var gl="shadow-composer";
var vl=11;
function yl(e){let t=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,{acceptNode:e=>e.parentElement?.closest(".ProseMirror-widget")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}),n=[],r=document.createRange();for(let e=t.nextNode();e;e=t.nextNode()){r.selectNodeContents(e);for(let e of r.getClientRects())(e.width>0||e.height>0)&&n.push(e)}return n}
function bl(e){let t;for(let n of yl(e))if(t===void 0)t=n.top;else if(Math.abs(n.top-t)>=vl)return!0;return!1}
function xl(e){if(e instanceof HTMLTextAreaElement)return Sl(e);if(e.childElementCount>1)return!0;let t=e.firstElementChild;return t?t.tagName!=="P"||t.querySelector("br:not(.ProseMirror-trailingBreak)")?!0:bl(t):!1}
function Sl(e){if(e.value==="")return!1;if(e.value.includes(`
`))return!0;let t=getComputedStyle(e),n=parseFloat(t.lineHeight)||parseFloat(t.fontSize)*1.2;if(!(n>0))return!1;let r=e.scrollHeight-parseFloat(t.paddingTop)-parseFloat(t.paddingBottom);return Math.round(r/n)>1}
function Cl(e){if(e.value==="")return 0;let t=getComputedStyle(e),n=e.ownerDocument,r=El(n);for(let e of wl)r.style.setProperty(e,t.getPropertyValue(e));r.textContent=e.value,n.body.append(r);let i=r.getBoundingClientRect().width;return r.remove(),i}
var wl=["font-family","font-size","font-style","font-weight","font-variation-settings","font-feature-settings","font-kerning","letter-spacing","word-spacing","tab-size","text-transform","text-rendering"];
var Tl=new WeakMap;
function El(e){let t=Tl.get(e);return t===void 0&&(t=e.createElement("span"),t.setAttribute("aria-hidden","true"),t.style.cssText="position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;white-space:pre;",Tl.set(e,t)),t}
var Dl=24;
function Ol({editorEl:e,enabled:t,reservedWidthPx:n,resetKey:r,contentKey:i,columnIsTwoRow:a=!1}){let[o,s]=O(!1),[c,l]=O(r);c!==r&&(l(r),s(!1));let u=E(o);m(()=>{u.current=o},[o]);let d=E(null),f=E(a);return xi(()=>{f.current=a,d.current?.()},[a]),m(()=>{if(!t||!e)return;let r=0,i=e=>I(()=>s(e)),a=()=>{if(r=0,e.offsetHeight===0)return;let t=u.current;if(xl(e)){t||i(!0);return}if(!t&&!f.current)return;let a=e.firstElementChild,o=0;if(e instanceof HTMLTextAreaElement)o=Cl(e);else if(a){let e=1/0,t=-1/0;for(let n of yl(a))e=Math.min(e,n.left),t=Math.max(t,n.right);o=t>e?t-e:0}let s=Dl*(Hi()/16)+n,c=o>e.clientWidth-s;c!==t&&i(c)},o=()=>{r===0&&(r=requestAnimationFrame(a))};o(),d.current=o;let c=new MutationObserver(o);c.observe(e,{subtree:!0,childList:!0,characterData:!0});let l=typeof ResizeObserver>"u"?null:new ResizeObserver(o);return l?.observe(e),()=>{d.current=null,c.disconnect(),l?.disconnect(),r!==0&&cancelAnimationFrame(r)}},[e,t,n,r]),m(()=>{d.current?.()},[i]),o}
var kl=()=>{let e=globalThis.scheduler;return e&&typeof e.postTask=="function"?e:null};
function Al(e){return!!e.dataTransfer?.types.includes("Files")}
function jl({targetRef:e,onFileDrop:t,disabled:n=!1,scope:r}){let[i,a]=O("idle"),o=!!t&&!n,s=na(t);return!o&&i!=="idle"&&a("idle"),m(()=>{if(!o||!s)return;let t=e=>{e.preventDefault(),s?.(e),a("idle")},n=t=>{if(!Al(t))return;t.preventDefault();let n=e.current,r=!!(n&&t.target instanceof Node&&n.contains(t.target));a(r?"on-target":"off-target")},i=t=>{if(!Al(t))return;let n=e.current;!(n&&t.relatedTarget instanceof Node&&n.contains(t.relatedTarget))&&(t.relatedTarget===null||t.target===document.body)&&a("idle")},c=t=>{if(!Al(t))return;let n=e.current;n&&t.target instanceof Node&&n.contains(t.target)||a("idle")},l=n=>{if(!Al(n))return;if(r==="page"){t(n);return}let i=e.current;i&&n.target instanceof Node&&i.contains(n.target)?t(n):n.preventDefault()},{body:u}=document;return u.addEventListener("drop",c,!0),u.addEventListener("dragover",n,!0),u.addEventListener("dragleave",i,!0),u.addEventListener("drop",l),()=>{u.removeEventListener("drop",c,!0),u.removeEventListener("dragover",n,!0),u.removeEventListener("dragleave",i,!0),u.removeEventListener("drop",l)}},[o,r,e,s]),o?i:"idle"}
var Ml=Oo;
var Nl={opacity:1,scale:1};
var Pl="shadow-[inset_0_0_0_2px_var(--cds-fill-accent)]";
var Fl="border border-dashed border-[color:var(--cds-fill-accent)]";
var Il="shadow-[inset_0_0_24px_0_color-mix(in_srgb,var(--cds-fill-accent)_20%,transparent)]";
var Ll="backdrop-blur-[12px]";
var Rl="opacity-60";
function zl(){return B("div",{className:"flex items-end gap-md",style:{color:"var(--cds-fill-accent)"},"aria-hidden":"true",children:[F("span",{className:"-rotate-[14deg]",children:F(oa,{name:"Image",size:"xl",className:ol,style:{"--rise-delay":"60ms"}})}),F("span",{className:"-translate-y-3",children:F(oa,{name:"Files",size:"xl",className:ol})}),F("span",{className:"rotate-[14deg]",children:F(oa,{name:"Folder",size:"xl",className:ol,style:{"--rise-delay":"120ms"}})})]})}
var Bl=`motion-safe:transition-[padding-left,padding-right,padding-bottom] ${oo}`;
var Vl="min-h-[var(--cmp-row-h)]";
var Hl=k({leadingRef:()=>void 0,trailingRef:()=>void 0,sendRef:()=>void 0});
var Ul=40;
var Wl=48;
var Gl=e=>!!e.closest('[data-cds="ChatComposerEditor"]');
var Kl=new Map;
function ql(e){let[t,n]=O(()=>Kl.get(e)??null),r=E(null),i=E(null),a=N(t=>{if(i.current?.disconnect(),i.current=null,!t){r.current=null,n(null);return}let a=()=>{let i=Math.ceil(t.offsetWidth);r.current=i,Kl.set(e,i),n(i)};if(a(),typeof ResizeObserver>"u")return;let o=new ResizeObserver(a);o.observe(t),i.current=o},[e]);return m(()=>()=>i.current?.disconnect(),[]),D(()=>({ref:a,width:t,latest:r}),[a,t])}
function Jl(e,t){let[n,r]=O(!0),i=E(null),a=E(e),o=E(null),s=N(()=>{let e=i.current;e&&a.current>0&&r(a.current<=e*vo)},[]);m(()=>{a.current=e,t&&s()},[e,t,s]);let c=N(e=>{if(o.current?.disconnect(),o.current=null,!e){i.current=null;return}if(!t||typeof ResizeObserver>"u")return;let n=new ResizeObserver(()=>{e.clientWidth>0&&(i.current=e.clientWidth,s())});n.observe(e),o.current=n},[t,s]);return m(()=>()=>o.current?.disconnect(),[]),[c,n]}
function Yl(e){return el(e.trailing)||el(e.children)||el(e.send)||el(e.idle)}
function Xl(e){return el(e.leading)}
function Zl(e){return el(e.send)}
var Ql=p(function({cutEpoch:e,sendCollapsed:t,send:n,idle:r,hasIdleSlot:i}){return B(M,{children:[F("div",{...Ti(t),className:R(sl,t&&"pointer-events-none invisible opacity-0"),children:n}),i?F("div",{...Ti(!t),className:R(sl,"justify-end",t?"opacity-100":cl),children:r}):null]},e)},(e,t)=>t.held||e.held===t.held&&e.cutEpoch===t.cutEpoch&&e.sendCollapsed===t.sendCollapsed&&e.send===t.send&&e.idle===t.idle&&e.hasIdleSlot===t.hasIdleSlot);
var $l=f(({className:e,leading:t,trailing:n,send:r,idle:i,children:a,...o},s)=>{let{hasContent:c,busy:l,pinSend:u}=x(Ua),{multiline:d,endInset:f}=x(Ml),{leadingRef:p,trailingRef:m,sendRef:h}=x(Hl),g=d&&f==="none"?void 0:Vl,_=Zl({send:r}),v=el(i),y=_&&v&&!c&&!l&&!u,[b,S]=O(l);l&&!b&&S(!0),!l&&b&&!y&&S(!1),xi(()=>{if(l||!b)return;if(document.visibilityState==="hidden"){S(!1);return}let e=!1,t=0,n,r=()=>{e=!0,cancelAnimationFrame(t),n!==void 0&&clearTimeout(n),document.removeEventListener("visibilitychange",a)},i=()=>{e||(r(),I(()=>{S(!1)}))},a=()=>{document.visibilityState==="hidden"&&!e&&(r(),S(!1))};return document.addEventListener("visibilitychange",a),t=requestAnimationFrame(()=>{let e=kl();e===null?n=setTimeout(i,0):e.postTask(i,{priority:"user-blocking"})}),r},[l,b]);let C=y&&b,[w,T]=O(b),[E,D]=O(0);b!==w&&(T(b),w&&y&&D(e=>e+1));let{gap:k,...A}=o;return B("div",{ref:s,"data-cds":"ChatComposerActions",className:aa("contents",e),...A,children:[Xl({leading:t})?F("div",{ref:p,className:aa("absolute bottom-0 left-0 flex shrink-0 items-center gap-xs pr-1.5 compact:pr-1.5 comfortable:pr-2",g),children:t}):null,Yl({trailing:n,children:a,send:r,idle:i})?B("div",{ref:m,className:aa("absolute bottom-0 right-0 flex shrink-0 items-center gap-xs pl-1.5 compact:pl-1.5 comfortable:pl-2",g),children:[n,a,_?F("div",{ref:h,...Ti(C),className:"grid shrink-0 items-center justify-items-end",children:F(Ql,{held:C,cutEpoch:E,sendCollapsed:y,send:r,idle:i,hasIdleSlot:v})}):i]}):null]})});
var eu="ps-[var(--cmp-chin-start)] pe-[var(--cmp-chin-end)]";
var tu="@max-[24rem]:px-0";
var nu={label:{glyph:"[--cmp-chin-end:calc(var(--cmp-pad-x)-2px)] compact:[--cmp-chin-end:calc(var(--cmp-pad-x)-2px)] comfortable:[--cmp-chin-end:var(--cmp-pad-x)]",text:"[--cmp-chin-end:var(--cmp-pad-x)] compact:[--cmp-chin-end:var(--cmp-pad-x)] comfortable:[--cmp-chin-end:calc(var(--cmp-pad-x)+1px)]"},glyph:{glyph:"[--cmp-chin-end:calc(var(--cmp-pad-x)-2px)] compact:[--cmp-chin-end:calc(var(--cmp-pad-x)-2px)] comfortable:[--cmp-chin-end:calc(var(--cmp-pad-x)+2px)]",text:"[--cmp-chin-end:calc(var(--cmp-pad-x)+2px)] compact:[--cmp-chin-end:calc(var(--cmp-pad-x)+2px)] comfortable:[--cmp-chin-end:calc(var(--cmp-pad-x)+3px)]"}};
function ru(e,t){return nu[t][e==="text"?"text":"glyph"]}
var iu="@max-[25rem]:text-caption";
var au="@max-[24rem]:ps-0 @max-[24rem]:[&_:is([data-cds=Button],[data-cds=ModelSelector])]:px-1";
function ou(e,t,n,r,i){let[a,o]=O("none");return xi(()=>{let a=t?e.current:null,s=a??r.current;if(s===null){o("none");return}let c=()=>{let e=a===null?i.map(e=>e.current):[],t=[...s.querySelectorAll('[data-cds="Button"],[data-cds="ModelSelector"]')].filter(t=>{if(e.some(e=>e!==null&&e.contains(t)))return!1;let n=t.closest("[hidden],[inert]");return n===null||n===s||!s.contains(n)}),r=n==="first"?t[0]:t[t.length-1];o(r===void 0?"none":r.hasAttribute("data-cds-icon-only")?"glyph":"label")};if(c(),typeof MutationObserver>"u")return;let l=new MutationObserver(c);return l.observe(s,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["data-cds-icon-only","data-cds","hidden","inert"]}),()=>l.disconnect()},[e,t,n,r,i]),a}
var su="sm";
var cu=f(({className:e,open:t=!0,leading:n,trailing:r,masked:i,children:a,...o},s)=>{let c=el(n),l=el(r),u=E(null),d=E(null),f=E(null),p=D(()=>[u,d],[]),m=ou(u,c,"first",f,p),h=ou(d,l,"last",f,p),g=c||m!=="none",_=m==="none"?"label":m,v=h==="none"?"label":h,{startInset:y}=x(Ml);return F("div",{ref:s,"data-cds":"ChatComposerChin","aria-hidden":!t,className:aa("relative z-0 grid grid-cols-[minmax(0,1fr)] overflow-clip px-2 -mx-2 pt-2 -mt-2 transition-[grid-template-rows] duration-[280ms] ease-out motion-reduce:transition-none","@container",yu,xu(y,_),ru(y,v),!i&&"pb-2 -mb-2",t?"grid-rows-[1fr]":"grid-rows-[0fr]",i&&"bg-page shadow-[0_0_0_32px_var(--cds-page-bg)] [clip-path:inset(-32px_0_0_0)]",e),...o,children:F("div",{...Ti(!t),className:R("min-h-0 transition-[opacity,translate] duration-[280ms] ease-out motion-reduce:transition-none",t?"translate-none opacity-100":"-translate-y-1.5 compact:-translate-y-1.5 comfortable:-translate-y-2 opacity-0"),children:F("div",{ref:f,...Bi("xs"),className:R("flex min-h-control items-center gap-0 text-footnote font-normal text-secondary","mt-1.5 compact:mt-1.5 comfortable:mt-2",i&&"mb-2",eu,!g&&tu,iu,"[&_[data-cds=Button]:not([aria-pressed=true])]:text-secondary [&_[data-cds=Button]]:font-normal",c||l?"justify-between":"justify-center"),children:B(Ji.Provider,{value:su,children:[c?F("div",{ref:u,className:"flex items-center self-start",children:n}):null,a,l?F("div",{ref:d,className:R("ms-auto flex min-w-0 items-center gap-1 ps-2",!g&&au),children:r}):null]})})})})});
var lu=f(({className:e,children:t,...n},r)=>{let{multiline:i,startInset:a,glideArmed:o,columnReservesTrailing:s}=x(Ml);return el(t)?F("div",{ref:r,"data-cds":"ChatComposerOverlay",className:aa("absolute inset-0 overflow-hidden",ao,So(a),!i&&!s&&"pr-[var(--cmp-trail-w,0px)]",o&&jo,e,"pointer-events-none"),...n,children:t}):null});
var uu=f(({className:e,children:t,...n},r)=>{let{startInset:i}=x(Ml);return el(t)?F("div",{ref:r,"data-cds":"ChatComposerHeader",className:aa("flex min-h-[var(--cds-h-control-nested)] min-w-0 items-center gap-xs text-footnote font-normal text-muted",So(i==="text"?"text":"glyph"),e),...n,children:t}):null});
var du=k("");
var fu=f(({className:e,children:t,...n},r)=>{let i=x(du),a=L.toArray(t).filter(e=>typeof e!="string"||e.trim()!=="");return F("div",{ref:r,"data-cds":"ChatComposerTray",className:aa(i,"min-w-0 overflow-hidden rounded-b-[inherit] empty:hidden",e),...n,children:a})});
var pu="cdsChatComposerPart";
function hu(e){return H(e)&&typeof e.type!="string"&&e.type[pu]==="Chin"}
function gu(e){let t=[],n=[],r=[],i=[],a=[],o=[],s=!1;for(let c of L.toArray(e))vu(c,uu)?t.push(c):vu(c,Ca)?n.push(c):vu(c,$l)?r.push(c):vu(c,cu)||hu(c)?i.push(c):vu(c,lu)?a.push(c):vu(c,fu)?o.push(c):s=!0;return{headers:t,attachments:n,actions:r,chin:i,overlays:a,tray:o,hasNonPart:s}}
function _u(e){return H(e)&&L.toArray(e.props.children).length>0}
function vu(e,t){if(!H(e))return!1;let n=e.type?.displayName;return e.type===t||!!n&&n===t.displayName}
var yu="[--cmp-pad-x:0.5rem] compact:[--cmp-pad-x:0.5rem] comfortable:[--cmp-pad-x:0.5rem]";
var bu={label:{glyph:"[--cmp-chin-start:var(--cmp-pad-x)]",text:"[--cmp-chin-start:calc(var(--cmp-pad-x)-2px)]"},glyph:{glyph:"[--cmp-chin-start:calc(var(--cmp-pad-x)+1px)]",text:"[--cmp-chin-start:calc(var(--cmp-pad-x)-1px)]"}};
function xu(e,t){return bu[t][e==="text"?"text":"glyph"]}
var Su="px-[var(--cmp-pad-x)]";
var Cu="py-2 compact:py-2 comfortable:py-2";
var wu="-mt-2 pt-2 compact:-mt-2 compact:pt-2 comfortable:-mt-2 comfortable:pt-2";
var Tu="-mx-[var(--cmp-pad-x)]";
var Eu="-mb-2 compact:-mb-2 comfortable:-mb-2";
var Du=gl;
var Ou="hover:[&:not(:where(:has(button:hover,a:hover,[role=button]:hover,label:hover)))]:shadow-composer-hover";
var ku="focus-within:shadow-composer-focus hover:focus-within:shadow-composer-focus";
var Au="border border-dashed border-[color-mix(in_srgb,var(--cds-gray-810)_30%,transparent)] dark:border-[color-mix(in_srgb,var(--cds-gray-100)_30%,transparent)]";
var ju="shadow-[0_0.25rem_1.25rem_color-mix(in_srgb,var(--cds-black)_3.5%,transparent)]";
var Mu="focus-within:shadow-[0_0.25rem_1.25rem_color-mix(in_srgb,var(--cds-black)_7.5%,transparent)]";
var Nu="(?:\\d|\\[|xs|sm|md|lg|xl|2xl|3xl|none|px|full|card|chip)";
var Pu="rounded(?:-(?:[setlrb]{1,2}|ss|se|es|ee))?(?:-"+Nu+"|\\b)";
var Fu="p(?:x|[lrse])?-"+Nu;
var Iu="p(?:y|[tb])?-"+Nu;
var Lu="gap(?:-y)?-"+Nu;
var Ru=new Map;
function zu(e,t,n){let r="(?:^|\\s)"+t+n,i=Ru.get(r);return i===void 0&&(i=new RegExp(r),Ru.set(r,i)),i.test(e)}
var Bu={dropFilesHere:"Drop files here",replyPlaceholder:"Reply"};
function Uu(e,t,n){if(t===void 0&&n===void 0)return e;let{"aria-label":r,"aria-labelledby":i,...a}=e??{};return{...a,...t!==void 0&&{"aria-label":t},...n!==void 0&&{"aria-labelledby":n}}}
function Wu({draftStoreKey:e,hasDraftText:t,hasDraftContent:n,busy:r,pinSend:i,form:a,children:o}){let[s,c]=O(null),[l,u]=O(e);l!==e&&(u(e),c(null));let d=(s??t())||n,f=D(()=>({hasContent:d,busy:r,pinSend:i,form:a}),[d,r,i,a]);return F(qa.Provider,{value:c,children:F(Ua.Provider,{value:f,children:o})})}
var Gu=f(({multiline:e,busy:t,pinSend:n,disabled:r,variant:i,form:a="new",onFileDrop:o,fileDropDisabled:s,dropScope:c,dropLabel:l,hasDraftContent:u,onClusterWidthsChange:d,motion:f,className:p,cardClassName:h,editor:g,"aria-label":_,"aria-labelledby":v,children:y,...b},S)=>{let C=g.draftStoreKey,[w,T]=O(!1),[k,j]=O(C);k!==C&&(j(C),T(!1));let M=g.onMeasureTarget,[P,I]=O(null),L=N(e=>{I(e),M?.(e)},[M]),{headers:V,attachments:U,actions:ee,chin:W,overlays:te,tray:G,hasNonPart:K}=D(()=>gu(y),[y]),q=!1,J=!1,ne=!1,re="base";for(let e of ee)if(H(e)){let t=e.props;t.gap==="tight"&&(re="tight"),q||=Xl(t),J||=Yl(t),ne||=Zl(t)}let Y=ql("leading"),ie=ql("trailing"),ae=ql("send"),oe=Y.width,se=ie.width,ce=D(()=>({leadingRef:Y.ref,trailingRef:ie.ref,sendRef:ae.ref}),[Y.ref,ie.ref,ae.ref]),le=q?oe??Ul:0,ue=J?se??Wl:0,[de,fe]=Jl(ue,!q),pe=!q&&fe,me=na(d),he=q?oe:0,ge=J?se:0,_e=ne?ae.width:0,ve=E(null);m(()=>{let e=q?Y.latest.current:0,t=J?ie.latest.current:0,n=ne?ae.latest.current:0;if(me===void 0){ve.current=null;return}if(e===null||t===null||n===null)return;let r=ve.current;(r===null||r.leading!==e||r.trailing!==t||r.send!==n)&&(ve.current={leading:e,trailing:t,send:n},me({leading:e,trailing:t,send:n}))},[me,q,J,ne,Y.latest,ie.latest,ae.latest,he,ge,_e]);let ye=U.some(_u),X=V.some(_u),[be,xe]=O(!1),[Se,Ce]=O(X);Se!==X&&(Ce(X),xe(!X));let we=X||be,Te=N(()=>{xe(!1)},[]),Ee=(g.minLines??1)>1,De=e??(ye||Ee),Oe=Ol({editorEl:P,enabled:e===void 0&&!Ee,reservedWidthPx:le+(pe?0:ue),resetKey:C,contentKey:g.contentKey,columnIsTwoRow:De}),ke=e??(De||Oe),Ae=q?ke?"glyph":"none":"text",je=x(eo).setComposerStartInset;xi(()=>{if(je!==void 0)return je(Ae),()=>je(void 0)},[je,Ae]);let Z=J&&(pe||!ke)?"actions":"none",Me=pe||g.trailingNotch==="pad",Ne=D(()=>({multiline:ke,startInset:Ae,endInset:Z,glideArmed:w,columnReservesTrailing:Me}),[ke,Ae,Z,w,Me]),Pe=E(null);m(()=>{if(!P||typeof ResizeObserver>"u")return;let e="",t=()=>{let e=P.children,t=e.length===0?P.offsetHeight:e[e.length-1].getBoundingClientRect().bottom-e[0].getBoundingClientRect().top,n=P.parentElement?.querySelectorAll(":scope > [data-composer-placeholder-ghost]"),r=t;return n?.forEach(e=>{r=Math.max(r,e.offsetHeight)}),r},n=()=>{let n=`${Math.ceil(t())}px`,r=Pe.current;r&&n!==e&&(r.style.setProperty("--cmp-wrap-h",n),e=n)},r=new ResizeObserver(n);r.observe(P);let i=0,a=typeof MutationObserver>"u"?void 0:new MutationObserver(()=>{i===0&&(i=requestAnimationFrame(()=>{i=0,n()}))});return a?.observe(P,{childList:!0,subtree:!0,characterData:!0}),P.parentElement&&a?.observe(P.parentElement,{childList:!0,attributes:!0,attributeFilter:["data-composer-placeholder-ghost"]}),()=>{r.disconnect(),a?.disconnect(),i!==0&&cancelAnimationFrame(i)}},[P]);let Fe=D(()=>({"--cmp-lead-w":`${le}px`,"--cmp-trail-w":`${ue}px`}),[le,ue]);m(()=>{if(!P||w)return;let e=0,t=requestAnimationFrame(()=>{e=requestAnimationFrame(()=>T(!0))});return()=>{cancelAnimationFrame(t),e!==0&&cancelAnimationFrame(e)}},[P,w]),m(()=>{if(w)return;let e=setTimeout(()=>T(!0),1e3);return()=>clearTimeout(e)},[w]);let Ie=E(null),Le=jl({targetRef:Ie,onFileDrop:o,disabled:s,scope:c}),Re=ka(Ie),ze=!!(r||g.disabled),Be=g.extraEditorAttributes,Ve=D(()=>Uu(Be,_,v),[Be,_,v]),He=g.render,Ue=D(()=>He({disabled:ze,onMeasureTarget:L,extraEditorAttributes:Ve}),[He,ze,L,Ve]),We=g.focus,{clickToFocusProps:Ge}=Ii(()=>We(),{disabled:ze,shouldIgnoreTarget:Gl}),Ke=Le==="off-target"||Le==="on-target",qe=c==="card"&&Le==="on-target",Je=Qi("dropFilesHere",Bu.dropFilesHere),Ye=l??Je,Xe=f!==void 0,[Ze]=O(()=>g.handoffCard),Qe=E(Xe),$e=ml();m(()=>{},[Xe,$e]),m(()=>{Qe.current=Xe},[Xe]);let et=h??"",tt=e=>zu(et,"(?:(?:comfortable|compact):)?",e),nt=tt(Pu),rt=tt(Fu),it=tt(Iu),at=tt(Lu);m(()=>{},[et]);let ot=W.length>0,st=W.length;m(()=>{},[st]);let ct=G.length;m(()=>{},[ct]),m(()=>{},[rt,ot]);let lt=aa(!rt&&Tu,!it&&Eu),ut=aa(R(hl,yu,"relative z-[1] flex w-full min-w-0 flex-col text-primary"),!nt&&"rounded-composer",!rt&&Su,!it&&Cu,"[--cmp-gap-y:0.375rem] compact:[--cmp-gap-y:0.375rem] comfortable:[--cmp-gap-y:0.5rem]",!at&&"gap-y-[var(--cmp-gap-y)]",ko,w?"transition-[background-color,border-color,box-shadow,opacity] duration-200":"transition-none",i==="incognito"?R(Au,ju,Mu):c==="card"&&Ke?"shadow-none":R(Du,!ze&&Ou,ku),ze?"cursor-default":"cursor-text",h),dt=B(A,{children:[F(rr,{initial:!1,onExitComplete:Te,children:X?F(rr.Div,{className:R("grid grid-rows-[1fr] overflow-hidden",!at&&"-mb-[var(--cmp-gap-y)]"),enterClassName:nl,exit:{height:0},children:F("div",{className:"min-h-0 min-w-0",children:F("div",{className:R(!at&&"pb-[var(--cmp-gap-y)]"),children:V})})},"header"):null}),ye?F("div",{className:R("-mx-2 grid grid-rows-[1fr] overflow-hidden px-2",!it&&!we&&wu),children:F("div",{"data-cds-composer-attachments":"",className:"min-h-0 min-w-0 px-1 pt-1 pb-2.5",children:F(ja.Provider,{value:Re,children:U})})}):null,B("div",{ref:de,className:"relative w-full min-w-0",style:Fe,children:[F("div",{ref:Pe,className:R("w-full min-w-0",w&&Bl,pe?Na:ke?(q||J)&&(re==="tight"?"pb-[calc(var(--cds-h-control)+0.125rem)]":"pb-[calc(var(--cds-h-control)+var(--cmp-gap-y))]"):["pl-[var(--cmp-lead-w)]",g.trailingNotch==="float"?"[&_.ProseMirror]:before:float-right [&_.ProseMirror]:before:content-[''] [&_.ProseMirror]:before:h-[var(--cmp-wrap-h,20px)] [&_.ProseMirror]:before:w-[var(--cmp-trail-w)] [&_.ProseMirror]:before:[shape-outside:inset(calc(100%-var(--cmp-row-h))_0_0_0)]":Na]),children:B("div",{className:"relative min-w-0 break-words",children:[Ue,te]})}),ee]}),G.length>0?F(du.Provider,{value:lt,children:G}):null,F(rr,{initial:!1,children:c==="card"&&Ke?B(rr.Div,{"data-cds":"ChatComposerDropPanel","aria-hidden":"true",exit:{opacity:0,scale:.95},transition:{duration:.2},style:Nl,className:"pointer-events-none absolute inset-0 z-[1] rounded-[inherit]",enterClassName:rl,children:[F("div",{"aria-hidden":"true",className:R("absolute inset-0 rounded-[inherit] transition-opacity duration-fast",Le==="on-target"?"opacity-0":"opacity-100",Fl)}),F("div",{"aria-hidden":"true",className:R("absolute inset-0 rounded-[inherit] transition-opacity duration-fast",Le==="on-target"?"opacity-100":"opacity-0",Pl)}),F("div",{"aria-hidden":"true",className:R("absolute inset-0 rounded-[inherit] transition-opacity duration-fast",Le==="on-target"?"opacity-100":"opacity-0",Il,al)})]},"chat-composer-drop-panel"):null})]});return F(Ml.Provider,{value:Ne,children:F(Wu,{draftStoreKey:C,hasDraftText:g.hasDraftText,hasDraftContent:!!u,busy:!!t,pinSend:!!n,form:a,children:F(Hl.Provider,{value:ce,children:B("div",{ref:S,"data-cds":"ChatComposer",[Fa]:"","data-variant":i==="default"?void 0:i,"data-form":a==="new"?void 0:a,"data-multiline":ke||void 0,"data-start-inset":Ae==="none"?void 0:Ae,"data-end-inset":Z==="none"?void 0:Z,"data-actions-gap":re==="base"?void 0:re,"data-busy":t||void 0,"data-disabled":ze||void 0,"data-drag-over":qe||void 0,className:aa("flex w-full min-w-0 flex-col font-sans",p),...b,children:[f!==void 0&&Ze!==void 0?F(Ze,{ref:Ie,layoutId:f.layoutId,layoutDependency:f.layoutDependency,transition:f.transition,className:ut,onMouseDown:Ge.onMouseDown,children:dt}):F("div",{ref:Ie,className:ut,onMouseDown:Ge.onMouseDown,children:dt}),c==="page"&&Ke?z(F(Yi,{children:B("div",{"data-cds":"ChatComposerDropScrim","aria-hidden":"true",style:{zIndex:Vi},className:"cds-reset fixed inset-0 pointer-events-none",children:[F("div",{"aria-hidden":"true",className:R("absolute inset-0",Ll,il)}),F("div",{"aria-hidden":"true",className:R("absolute inset-0 bg-page",Rl,il)}),B("div",{className:R("absolute inset-3.5 flex flex-col items-center justify-center gap-sm rounded-card",Pl,rl),children:[F("div",{"aria-hidden":"true",className:R("absolute inset-0 rounded-[inherit]",Il,al)}),F(zl,{}),F("span",{className:"text-body font-medium text-accent",children:Ye})]})]})}),document.body):null,W]})})})})});
var sf="gap-1";
function ky(e){let t=e.replace(/[\t\n\r]/g,"");if(t[0]==="/"&&t[1]!=="/"&&t[1]!=="\\")return e;let n;try{n=new URL(e,window.location.origin)}catch{return"#"}return n.protocol!=="https:"&&n.protocol!=="http:"?"#":n.origin===window.location.origin||/^https?:\/\//i.test(e.trim())?e:"#"}
function Py(e){return Number.isFinite(e)?e:void 0}
function Fy(e){return[e.updatedAtMs,e.createdAtMs].find(e=>e!==void 0&&Number.isFinite(e))}
function Iy(e,t){return e.title||t.formatMessage({defaultMessage:"Untitled artifact",id:"7tJmPLpUEM"})}

export { sf, Gu, gu, vu, uu, Ml, el, $l, Hl, Vl, Zl, kl, Xl, Yl, Ql, sl, cl, cu, ou, yu, xu, bu, ru, nu, eu, tu, iu, su, au, hu, pu, lu, fu, du, ql, Kl, Ul, Wl, Jl, _u, Ol, xl, Sl, bl, yl, vl, Cl, El, Tl, wl, Dl, jl, Al, Uu, Gl, Bu, ml, pl, zu, Ru, Pu, Nu, Fu, Iu, Lu, Tu, Eu, hl, Su, Cu, Au, ju, Mu, Du, gl, Ou, ku, nl, wu, Bl, Nl, rl, Fl, Pl, Il, al, Wu, Ll, il, Rl, zl, ol, Py, Fy, ky, Iy, f, O, N, D, L, H, x, Oo, F, aa, So, Ca, Ua, k, xi, I, B, Ti, p, M, R, E, Bi, Ji, ao, jo, m, vo, na, Hi, eo, ka, Ii, Qi, ko, A, rr, ja, oo, Na, qa, Fa, z, Yi, Vi, oa };
