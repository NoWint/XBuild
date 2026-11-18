// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { w as B } from "./vendor-frame-foKw4lFA.js";
import { W as _ } from "./vendor-frame-foKw4lFA.js";
import { M as N } from "./vendor-frame-foKw4lFA.js";
import { V as H } from "./vendor-frame-foKw4lFA.js";
import { l as L } from "./vendor-frame-foKw4lFA.js";
import { T as w } from "./vendor-frame-foKw4lFA.js";
import { N as u } from "./vendor-frame-foKw4lFA.js";
import { Pa as Kr } from "./shared-26-CT0kz82X.js";
import { zp as Qi } from "./shared-frame-DVFSKIcx.js";
import { K as k } from "./vendor-frame-foKw4lFA.js";
import { X as $i } from "./shared-frame-DVFSKIcx.js";
import { ja as Lr } from "./shared-26-CT0kz82X.js";
import { Attachments as ho } from "../../source-chat-adapters.jsx";
import { Fa as jr } from "./shared-26-CT0kz82X.js";
import { x as R } from "./vendor-frame-foKw4lFA.js";
import { Q as xa } from "./shared-frame-DVFSKIcx.js";
import { ds as F } from "./vendor-frame-foKw4lFA.js";
import { me as P } from "./vendor-frame-foKw4lFA.js";
import { Rp as _a } from "./shared-frame-DVFSKIcx.js";
import { D as z } from "./vendor-frame-foKw4lFA.js";
import { d as A } from "./vendor-frame-foKw4lFA.js";
import { ge as I } from "./vendor-frame-foKw4lFA.js";
import { G as E } from "./vendor-frame-foKw4lFA.js";
import { Zt as fo } from "./shared-frame-DVFSKIcx.js";
import { Jt as aa } from "./shared-frame-DVFSKIcx.js";
import { yo as za } from "./shared-frame-DVFSKIcx.js";
import { U as D } from "./vendor-frame-foKw4lFA.js";
import { Gn as Pa } from "./shared-frame-DVFSKIcx.js";
import { $i as la } from "./shared-frame-DVFSKIcx.js";
import { il as ca } from "./shared-frame-DVFSKIcx.js";
import { Ca as Wr } from "./shared-26-CT0kz82X.js";
import { Ta as Ur } from "./shared-26-CT0kz82X.js";
import { Ol as Ua } from "./shared-frame-DVFSKIcx.js";
import { Wn as $a } from "./shared-frame-DVFSKIcx.js";
import { I as b } from "./vendor-frame-foKw4lFA.js";
import { Na as zr } from "./shared-26-CT0kz82X.js";
import { yn as co } from "./shared-frame-DVFSKIcx.js";
import { ka as Gr } from "./shared-26-CT0kz82X.js";
import { ld as Ga } from "./shared-frame-DVFSKIcx.js";
import { Hi as ha } from "./shared-frame-DVFSKIcx.js";
import { ao as ba } from "./shared-frame-DVFSKIcx.js";
import { vl as _t } from "../chat/shared-8-B5xbG2px.js";
import { Ua as ia } from "./shared-frame-DVFSKIcx.js";
import { od as Ea } from "./shared-frame-DVFSKIcx.js";
import { useAttachmentAnchor as So } from "../../source-chat-adapters.jsx";
import { qp as sa } from "./shared-frame-DVFSKIcx.js";
import { sd as Za } from "./shared-frame-DVFSKIcx.js";
import { Z as oo } from "./shared-frame-DVFSKIcx.js";
import { Sa as Pr } from "./shared-26-CT0kz82X.js";
import { pe as M } from "./vendor-frame-foKw4lFA.js";
import { Presence as rs } from "../../source-chat-adapters.jsx";
import { AttachmentAnchorContext as ko } from "../../source-chat-adapters.jsx";
import { wa as Mr } from "./shared-26-CT0kz82X.js";
import { Ra as ni } from "./shared-26-CT0kz82X.js";
import { Ia as ci } from "./shared-26-CT0kz82X.js";
import { vu as mt } from "./shared-1-BPVqFfwb.js";
import { Du as qe } from "./shared-1-BPVqFfwb.js";
import { us as y } from "./vendor-frame-foKw4lFA.js";
import { Cd as Sa } from "./shared-frame-DVFSKIcx.js";
import { Ju as ro } from "./shared-frame-DVFSKIcx.js";
import { Lo as Na } from "./shared-frame-DVFSKIcx.js";
import { za as ai } from "./shared-26-CT0kz82X.js";
import { Oa as Br } from "./shared-26-CT0kz82X.js";
var Ou="motion-safe:animate-[cds-grid-rows-in_0.3s_cubic-bezier(0.25,0.1,0.35,1)]";
var ku="motion-safe:animate-[cds-drop-ring-in_0.15s_cubic-bezier(0.215,0.61,0.355,1)]";
var Au="motion-safe:animate-[cds-fade-in_0.15s_cubic-bezier(0.215,0.61,0.355,1)]";
var ju="motion-safe:animate-[cds-fade-in_0.2s_cubic-bezier(0.215,0.61,0.355,1)_0.08s_backwards]";
var Mu="motion-safe:animate-[cds-drop-icon-rise_0.22s_cubic-bezier(0.215,0.61,0.355,1)_var(--rise-delay,0ms)_backwards]";
var Nu="col-start-1 row-start-1 flex cursor-default items-center transition-[opacity,visibility] duration-fast";
var Pu="send-slot";
var Fu="idle-slot";
var Iu="pointer-events-none invisible opacity-0";
var Hu=R(!1);
function Uu(){return u(Hu)}
var Wu="bg-surface-3";
var Gu="shadow-composer";
var qu=".ProseMirror-widget";
var Ju=11;
function Yu(e){let t=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,{acceptNode:e=>e.parentElement?.closest(".ProseMirror-widget")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}),n=[],r=document.createRange();for(let e=t.nextNode();e;e=t.nextNode()){r.selectNodeContents(e);for(let e of r.getClientRects())(e.width>0||e.height>0)&&n.push(e)}return n}
function Xu(e){let t=e=>Math.max(0,parseFloat(e)||0),n=1/0,r=-1/0,i;for(let a of e.querySelectorAll(qu)){let e=ha(a),o=e?.getComputedStyle(a);if(!(!o||o.position==="absolute"||o.position==="fixed")){i=e;for(let e of a.getClientRects())n=Math.min(n,e.left-t(o.marginLeft)),r=Math.max(r,e.right+t(o.marginRight))}}if(!i||r<n)return 0;for(let t of Yu(e))n=Math.min(n,t.left),r=Math.max(r,t.right);let a=e.getBoundingClientRect();return i.getComputedStyle(e).direction==="rtl"?a.right-n:r-a.left}
function Zu(e){let t;for(let n of Yu(e))if(t===void 0)t=n.top;else if(Math.abs(n.top-t)>=Ju)return!0;return!1}
function Qu(e){if(Ga(e))return $u(e);if(e.childElementCount>1)return!0;let t=e.firstElementChild;return t?t.tagName!=="P"||t.querySelector("br:not(.ProseMirror-trailingBreak)")?!0:Zu(t):!1}
function $u(e){if(e.value==="")return!1;if(e.value.includes(`
`))return!0;let t=getComputedStyle(e),n=parseFloat(t.lineHeight)||parseFloat(t.fontSize)*1.2;if(!(n>0))return!1;let r=e.scrollHeight-parseFloat(t.paddingTop)-parseFloat(t.paddingBottom);return Math.round(r/n)>1}
function ed(e){if(e.value==="")return 0;let t=getComputedStyle(e),n=e.ownerDocument,r=rd(n);for(let e of td)r.style.setProperty(e,t.getPropertyValue(e));r.textContent=e.value,n.body.append(r);let i=r.getBoundingClientRect().width;return r.remove(),i}
var td=["font-family","font-size","font-style","font-weight","font-variation-settings","font-feature-settings","font-kerning","letter-spacing","word-spacing","tab-size","text-transform","text-rendering"];
var nd=new WeakMap;
function rd(e){let t=nd.get(e);return t===void 0&&(t=e.createElement("span"),t.setAttribute("aria-hidden","true"),t.style.cssText="position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;white-space:pre;",nd.set(e,t)),t}
var id=24;
var ad=1;
function od({editorEl:e,enabled:t,reservedWidthPx:n,resetKey:r,contentKey:i,columnIsTwoRow:a=!1}){let[o,s]=_(!1),[c,l]=_(r);c!==r&&(l(r),s(!1));let u=D(o);b(()=>{u.current=o},[o]);let d=D(null),f=D(a);return xa(()=>{f.current=a,d.current?.()},[a]),b(()=>{if(!t||!e)return;let r=0,i=e=>F(()=>s(e)),a=()=>{if(r=0,e.offsetHeight===0)return;let t=u.current;if(Qu(e)){t||i(!0);return}if(!t&&!f.current)return;let a=e.firstElementChild,o=0,s=0;if(Ga(e))o=ed(e),s=o;else if(a){let e=1/0,t=-1/0;for(let n of Yu(a))e=Math.min(e,n.left),t=Math.max(t,n.right);o=t>e?t-e:0,s=Math.max(o,Xu(a))}let c=id*(ba()/16)+n,l=o>e.clientWidth-c||s>e.clientWidth-n-ad;l!==t&&i(l)},o=()=>{r===0&&(r=requestAnimationFrame(a))};o(),d.current=o;let c=Pa(MutationObserver,o);c.observe(e,{subtree:!0,childList:!0,characterData:!0});let l=Ua(e),p=l===void 0?null:$a(l,o);return p?.observe(e),()=>{d.current=null,c.disconnect(),p?.disconnect(),r!==0&&cancelAnimationFrame(r)}},[e,t,n,r]),b(()=>{d.current?.()},[i]),o}
var sd=2;
function cd(e){return e.nodeType===Node.TEXT_NODE}
function ld(e,t,n){if(typeof e.caretPositionFromPoint=="function"){let r=e.caretPositionFromPoint(t,n);return r?{node:r.offsetNode,offset:r.offset}:null}if(typeof e.caretRangeFromPoint=="function"){let r=e.caretRangeFromPoint(t,n);return r?{node:r.startContainer,offset:r.startOffset}:null}return null}
function ud({node:e,offset:t}){let n=e.ownerDocument.createRange();n.setStart(e,t),n.setEnd(e,t+1);let r=n.getClientRects();return r[r.length-1]??null}
function dd(e,t){let{node:n,offset:r}=t;if(!cd(n))return null;let i=n;for(;i.parentNode&&i.parentNode!==e;)i=i.parentNode;let a=e.ownerDocument.createTreeWalker(i,NodeFilter.SHOW_TEXT),o=e=>{a.currentNode=n;for(let t=e();t;t=e())if(cd(t)&&t.length>0)return t;return null},s=r>0?n:o(()=>a.previousNode()),c=r<n.length?n:o(()=>a.nextNode());return!s||!c?null:{before:{node:s,offset:(s===n?r:s.length)-1},after:{node:c,offset:c===n?r:0}}}
function fd(e,t,n){let r=dd(e,t),i=r&&ud(r.before),a=r&&ud(r.after);if(!i||!a)return!1;let o=a.top>=i.bottom-sd,s=n<(i.bottom+a.top)/2;return o&&s}
function pd(e,t,n){let r=null;for(let n=t.node;n&&n!==e;n=n.parentNode)Za(n)&&n.getAttribute("contenteditable")==="false"&&(r=n);let i=r?.parentNode;if(!r||!i)return t;let a=r.getBoundingClientRect(),o=n>=(a.left+a.right)/2,s=Za(i)&&e.ownerDocument.defaultView?.getComputedStyle(i).direction==="rtl";return{node:i,offset:Array.prototype.indexOf.call(i.childNodes,r)+(o===s?0:1)}}
function md(e,t){let{focusNode:n,focusOffset:r}=e,i=n?.ownerDocument?.createRange();return!n||!i?!1:(i.setStart(t.node,t.offset),i.collapse(!0),i.comparePoint(n,r)<0?i.setStart(n,r):i.setEnd(n,r),!/[^\s\u200B]/.test(i.toString()))}
function hd(e,t,n,r){if(!e||Ga(e)||!e.isContentEditable)return!1;let i=e.getBoundingClientRect(),a=(e.closest('[data-cds="ChatComposerEditor"]')??e).getBoundingClientRect(),o=Math.max(i.top,a.top),s=Math.min(i.bottom,a.bottom),c=n>=o&&n<s;if(n<a.top||n>=a.bottom||c&&t>=i.left&&t<i.right)return!1;let l=e.ownerDocument,u=l.getSelection(),d=Math.min(Math.max(t,i.left+1),i.right-1),f=c?n:n<o?o+1:s-1,p=ld(l,d,f);if(!u||!p||p.node===e||!e.contains(p.node))return!1;let m=pd(e,p,d),h=typeof u.modify=="function"&&fd(e,m,f);return u.removeAllRanges(),e.focus({preventScroll:!0}),u.collapse(m.node,m.offset),h&&(u.modify("move","backward","character"),u.modify("move","forward","lineboundary"),md(u,m)||u.collapse(m.node,m.offset)),u.anchorNode&&r?.(u.anchorNode,u.anchorOffset),!0}
var gd=()=>{let e=globalThis.scheduler;return e&&typeof e.postTask=="function"?e:null};
function _d(e){return!!e.dataTransfer?.types.includes("Files")}
function vd({targetRef:e,onFileDrop:t,disabled:n=!1,scope:r}){let[i,a]=_("idle"),o=!!t&&!n,s=co(t),c=ia()?.document;return!o&&i!=="idle"&&a("idle"),b(()=>{let t=(e.current?.ownerDocument??c)?.body;if(!o||!s||!t)return;let n=e=>{e.preventDefault(),s?.(e),a("idle")},i=t=>{if(!_d(t))return;t.preventDefault();let n=e.current,r=!!(n&&Ea(t.target)&&n.contains(t.target));a(r?"on-target":"off-target")},l=n=>{if(!_d(n))return;let r=e.current;!(r&&Ea(n.relatedTarget)&&r.contains(n.relatedTarget))&&(n.relatedTarget===null||n.target===t)&&a("idle")},u=t=>{if(!_d(t))return;let n=e.current;n&&Ea(t.target)&&n.contains(t.target)||a("idle")},d=()=>a("idle"),f=t=>{if(!_d(t))return;if(r==="page"){n(t);return}let i=e.current;i&&Ea(t.target)&&i.contains(t.target)?n(t):t.preventDefault()};return t.addEventListener("drop",u,!0),t.addEventListener("dragover",i,!0),t.addEventListener("dragleave",l,!0),t.addEventListener("dragend",d,!0),r==="page"&&t.addEventListener("pointerdown",d,!0),t.addEventListener("drop",f),()=>{t.removeEventListener("drop",u,!0),t.removeEventListener("dragover",i,!0),t.removeEventListener("dragleave",l,!0),t.removeEventListener("dragend",d,!0),t.removeEventListener("pointerdown",d,!0),t.removeEventListener("drop",f)}},[o,r,e,s,c]),o?i:"idle"}
var yd=Kr;
var bd={opacity:1,scale:1};
var xd="shadow-[inset_0_0_0_2px_var(--cds-fill-accent)]";
var Sd="border border-dashed border-[color:var(--cds-fill-accent)]";
var Cd="shadow-[inset_0_0_24px_0_color-mix(in_srgb,var(--cds-fill-accent)_20%,transparent)]";
var wd="backdrop-blur-[12px]";
var Td="opacity-60";
function Ed(){return P("div",{className:"flex items-end gap-md",style:{color:"var(--cds-fill-accent)"},"aria-hidden":"true",children:[k("span",{className:"-rotate-[14deg]",children:k(Na,{name:"Image",size:"xl",className:Mu,style:{"--rise-delay":"60ms"}})}),k("span",{className:"-translate-y-3",children:k(Na,{name:"Files",size:"xl",className:Mu})}),k("span",{className:"rotate-[14deg]",children:k(Na,{name:"Folder",size:"xl",className:Mu,style:{"--rise-delay":"120ms"}})})]})}
var Dd=z(function({dropLabel:e}){return k(Sa,{children:P("div",{"data-cds":"ChatComposerDropScrim","aria-hidden":"true",style:{zIndex:ro},className:"cds-reset fixed inset-0 pointer-events-none",children:[k("div",{"aria-hidden":"true",className:I("absolute inset-0",wd,Au)}),k("div",{"aria-hidden":"true",className:I("absolute inset-0 bg-page",Td,Au)}),P("div",{className:I("absolute inset-3.5 flex flex-col items-center justify-center gap-sm rounded-card",xd,ku),children:[k("div",{"aria-hidden":"true",className:I("absolute inset-0 rounded-[inherit]",Cd,ju)}),k(Ed,{}),k("span",{className:"text-body font-medium text-accent",children:e})]})]})})});
var Od=`motion-safe:transition-[padding-left,padding-right,padding-bottom] ${Mr}`;
var kd="min-h-[var(--cmp-row-h)]";
var Ad=R({leadingRef:()=>void 0,trailingRef:()=>void 0,sendRef:()=>void 0});
var jd=40;
var Md=48;
var Nd=e=>{let t=e.closest('[data-cds="ChatComposerEditor"]');return t!==null&&e!==t};
var Pd=e=>Za(e)&&e.dataset.cds==="ChatComposerEditor"&&e.scrollHeight>e.clientHeight+1;
var Fd=16;
function Id({target:e,clientX:t,clientY:n},r){if(!r||!Pd(e))return!1;let i=r.getBoundingClientRect(),{left:a,right:o}=e.getBoundingClientRect();return t>=i.left&&t<i.right&&n>=i.top&&n<i.bottom||(ha(e)?.getComputedStyle(e).direction==="rtl"?t<a+Fd:t>=o-Fd)}
var Ld=new Map;
function Rd(e){let[t,n]=_(()=>Ld.get(e)??null),r=D(null),i=D(null),a=N(t=>{if(i.current?.disconnect(),i.current=null,!t){r.current=null,n(null);return}let a=()=>{let i=Math.ceil(t.offsetWidth);r.current=i,Ld.set(e,i),n(i)};a();let o=Ua(t);if(o===void 0)return;let s=$a(o,a);s.observe(t),i.current=s},[e]);return b(()=>()=>i.current?.disconnect(),[]),H(()=>({ref:a,width:t,latest:r}),[a,t])}
function zd(e,t){let[n,r]=_(!0),i=D(null),a=D(e),o=D(null),s=N(()=>{let e=i.current;e&&a.current>0&&r(a.current<=e*zr)},[]);b(()=>{a.current=e,t&&s()},[e,t,s]);let c=N(e=>{if(o.current?.disconnect(),o.current=null,!e){i.current=null;return}let n=Ua(e);if(!t||n===void 0)return;let r=$a(n,()=>{e.clientWidth>0&&(i.current=e.clientWidth,s())});r.observe(e),o.current=r},[t,s]);return b(()=>()=>o.current?.disconnect(),[]),[c,n]}
function Bd(e){return Qi(e.trailing)||Qi(e.children)||Qi(e.send)||Qi(e.idle)}
function Vd(e){return Qi(e.leading)}
function Hd(e){return Qi(e.send)}
var Ud=z(function({cutEpoch:e,sendCollapsed:t,send:n,idle:r,hasIdleSlot:i}){return P(A,{children:[k("div",{"data-cds-part":Pu,..._a(t),className:I(Nu,t&&"pointer-events-none invisible opacity-0"),children:n}),i?k("div",{"data-cds-part":Fu,..._a(!t),className:I(Nu,"justify-end",t?"opacity-100":Iu),children:r}):null]},e)},(e,t)=>t.held||e.held===t.held&&e.cutEpoch===t.cutEpoch&&e.sendCollapsed===t.sendCollapsed&&e.send===t.send&&e.idle===t.idle&&e.hasIdleSlot===t.hasIdleSlot);
var Wd=B(({className:e,leading:t,trailing:n,send:r,idle:i,children:a,...o},s)=>{let{hasContent:c,busy:l,pinSend:d}=u(jr),{multiline:f,endInset:p}=u(yd),{leadingRef:m,trailingRef:h,sendRef:g}=u(Ad),v=f&&p==="none"?void 0:kd,y=Hd({send:r}),b=Qi(i),x=y&&b&&!c&&!l&&!d,[S,C]=_(l);l&&!S&&C(!0),!l&&S&&!x&&C(!1),xa(()=>{if(l||!S)return;if(document.visibilityState==="hidden"){C(!1);return}let e=!1,t=0,n,r=()=>{e=!0,cancelAnimationFrame(t),n!==void 0&&clearTimeout(n),document.removeEventListener("visibilitychange",a)},i=()=>{e||(r(),F(()=>{C(!1)}))},a=()=>{document.visibilityState==="hidden"&&!e&&(r(),C(!1))};return document.addEventListener("visibilitychange",a),t=requestAnimationFrame(()=>{let e=gd();e===null?n=setTimeout(i,0):e.postTask(i,{priority:"user-blocking"})}),r},[l,S]);let w=x&&S,[T,E]=_(S),[D,O]=_(0);S!==T&&(E(S),T&&x&&O(e=>e+1));let{gap:A,...j}=o;return P("div",{ref:s,"data-cds":"ChatComposerActions",className:$i("contents",e),...j,children:[Vd({leading:t})?k("div",{ref:m,className:$i("absolute bottom-0 left-0 flex shrink-0 items-center gap-xs pr-1.5 compact:pr-1.5 comfortable:pr-2",v),children:t}):null,Bd({trailing:n,children:a,send:r,idle:i})?P("div",{ref:h,className:$i("absolute bottom-0 right-0 flex shrink-0 items-center gap-xs pl-1.5 compact:pl-1.5 comfortable:pl-2",v),children:[n,a,y?k("div",{ref:g,..._a(w),className:"grid shrink-0 items-center justify-items-end",children:k(Ud,{held:w,cutEpoch:D,sendCollapsed:x,send:r,idle:i,hasIdleSlot:b})}):i]}):null]})});
var Gd="ps-[calc(var(--cmp-chin-start)_-_var(--cmp-chin-touch-grow,0px))] pe-[calc(var(--cmp-chin-end)_-_var(--cmp-chin-touch-grow,0px))]";
var Kd="[--cmp-chin-row-h:var(--cds-h-control--xs)]";
var qd="@max-[24rem]:px-0";
var Jd={label:{glyph:"[--cmp-chin-end:calc(var(--cmp-pad-x)-2px)] compact:[--cmp-chin-end:calc(var(--cmp-pad-x)-2px)] comfortable:[--cmp-chin-end:var(--cmp-pad-x)]",text:"[--cmp-chin-end:var(--cmp-pad-x)] compact:[--cmp-chin-end:var(--cmp-pad-x)] comfortable:[--cmp-chin-end:calc(var(--cmp-pad-x)+1px)]"},glyph:{glyph:"[--cmp-chin-end:calc(var(--cmp-pad-x)-2px)] compact:[--cmp-chin-end:calc(var(--cmp-pad-x)-2px)] comfortable:[--cmp-chin-end:calc(var(--cmp-pad-x)+2px)]",text:"[--cmp-chin-end:calc(var(--cmp-pad-x)+2px)] compact:[--cmp-chin-end:calc(var(--cmp-pad-x)+2px)] comfortable:[--cmp-chin-end:calc(var(--cmp-pad-x)+3px)]"}};
function Yd(e,t){return Jd[t][e==="text"?"text":"glyph"]}
var Xd="@max-[25rem]:text-caption";
var Zd="@max-[24rem]:ps-0 @max-[24rem]:[&_:is([data-cds=Button],[data-cds=ModelSelector])]:px-1";
function Qd(e,t,n,r,i){let[a,o]=_("none");return xa(()=>{let a=t?e.current:null,s=a??r.current;if(s===null){o("none");return}let c=()=>{let e=a===null?i.map(e=>e.current):[],t=[...s.querySelectorAll('[data-cds="Button"],[data-cds="ModelSelector"]')].filter(t=>{if(e.some(e=>e!==null&&e.contains(t)))return!1;let n=t.closest("[hidden],[inert]");return n===null||n===s||!s.contains(n)}),r=n==="first"?t[0]:t[t.length-1];o(r===void 0?"none":r.hasAttribute("data-cds-icon-only")?"glyph":"label")};if(c(),typeof MutationObserver>"u")return;let l=Pa(MutationObserver,c);return l.observe(s,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["data-cds-icon-only","data-cds","hidden","inert"]}),()=>l.disconnect()},[e,t,n,r,i]),a}
var $d="sm";
var ef=B(({className:e,open:t=!0,leading:n,trailing:r,masked:i,children:a,...o},s)=>{let c=Qi(n),l=Qi(r),d=E(fo,aa,()=>!1),f=za("auto"),p=D(null),m=D(null),h=D(null),g=H(()=>[p,m],[]),_=Qd(p,c,"first",h,g),v=Qd(m,l,"last",h,g),y=c||_!=="none",b=_==="none"?"label":_,x=v==="none"?"label":v,{startInset:S}=u(yd);return k("div",{ref:s,"data-cds":"ChatComposerChin","aria-hidden":!t,className:$i("relative z-0 overflow-clip px-2 -mx-2 pt-2 -mt-2","@container",ff,mf(S,b),Yd(S,x),!i&&"pb-2 -mb-2",i&&"bg-page shadow-[0_0_0_32px_var(--cds-page-bg)] [clip-path:inset(-32px_0_0_0)]",e),...o,children:k("div",{className:I("grid grid-cols-[minmax(0,1fr)] transition-[grid-template-rows] duration-[280ms] ease-out motion-reduce:transition-none",t?"grid-rows-[1fr]":"grid-rows-[0fr]"),children:k("div",{..._a(!t),className:I("min-h-0 transition-[opacity,translate] duration-[280ms] ease-out motion-reduce:transition-none",t?"translate-none opacity-100":"-translate-y-1.5 compact:-translate-y-1.5 comfortable:-translate-y-2 opacity-0"),children:k("div",{ref:h,...la("xs"),"data-touch-size":"",className:I("flex min-h-control items-center gap-0 text-footnote font-normal text-secondary","mt-1.5 compact:mt-1.5 comfortable:mt-2",i&&"mb-2",Gd,Kd,!y&&qd,Xd,"[&_[data-cds=Button]:not([aria-pressed=true])]:text-secondary [&_[data-cds=Button]]:font-normal",c||l?"justify-between":"justify-center"),children:P(ca.Provider,{value:d?f:$d,children:[c?k("div",{ref:p,className:"flex items-center self-start",children:n}):null,a,l?k("div",{ref:m,className:I("ms-auto flex min-w-0 items-center gap-1 ps-2",!y&&Zd),children:r}):null]})})})})})});
var tf=B(({className:e,children:t,...n},r)=>{let{multiline:i,startInset:a,glideArmed:o,columnReservesTrailing:s}=u(yd);return Qi(t)?k("div",{ref:r,"data-cds":"ChatComposerOverlay",className:$i("absolute inset-0 overflow-hidden",Wr,Lr(a),!i&&!s&&"pr-[var(--cmp-trail-w,0px)]",o&&Ur,e,"pointer-events-none"),...n,children:t}):null});
var nf=B(({className:e,children:t,...n},r)=>{let{startInset:i}=u(yd);return Qi(t)?k("div",{ref:r,"data-cds":"ChatComposerHeader",className:$i("flex min-h-[var(--cds-h-control-nested)] min-w-0 items-center gap-xs text-footnote font-normal text-muted",Lr(i==="text"?"text":"glyph"),e),...n,children:t}):null});
var rf=R("");
var af=B(({className:e,children:t,...n},r)=>{let i=u(rf),a=L.toArray(t).filter(e=>typeof e!="string"||e.trim()!=="");return k("div",{ref:r,"data-cds":"ChatComposerTray",className:$i(i,"min-w-0 overflow-hidden rounded-b-[inherit] empty:hidden",e),...n,children:a})});
var of="cdsChatComposerPart";
function cf(e){return w(e)&&typeof e.type!="string"&&e.type[of]==="Chin"}
function lf(e){let t=[],n=[],r=[],i=[],a=[],o=[],s=!1;for(let c of L.toArray(e))df(c,nf)?t.push(c):df(c,ho)?n.push(c):df(c,Wd)?r.push(c):df(c,ef)||cf(c)?i.push(c):df(c,tf)?a.push(c):df(c,af)?o.push(c):s=!0;return{headers:t,attachments:n,actions:r,chin:i,overlays:a,tray:o,hasNonPart:s}}
function uf(e){return w(e)&&L.toArray(e.props.children).length>0}
function df(e,t){if(!w(e))return!1;let n=e.type?.displayName;return e.type===t||!!n&&n===t.displayName}
var ff="[--cmp-pad-x:0.5rem] compact:[--cmp-pad-x:0.5rem] comfortable:[--cmp-pad-x:0.5rem]";
var pf={label:{glyph:"[--cmp-chin-start:var(--cmp-pad-x)]",text:"[--cmp-chin-start:calc(var(--cmp-pad-x)-2px)]"},glyph:{glyph:"[--cmp-chin-start:calc(var(--cmp-pad-x)+1px)]",text:"[--cmp-chin-start:calc(var(--cmp-pad-x)-1px)]"}};
function mf(e,t){return pf[t][e==="text"?"text":"glyph"]}
var hf="px-[var(--cmp-pad-x)]";
var gf="py-2 compact:py-2 comfortable:py-2";
var _f="-mt-2 pt-2 compact:-mt-2 compact:pt-2 comfortable:-mt-2 comfortable:pt-2";
var vf="-mx-[var(--cmp-pad-x)]";
var yf="-mb-2 compact:-mb-2 comfortable:-mb-2";
var bf=Gu;
var xf="hover:[&:not(:where(:has(button:hover,a:hover,[role=button]:hover,label:hover)))]:shadow-composer-hover";
var Sf="focus-within:shadow-composer-focus hover:focus-within:shadow-composer-focus";
var Cf="border border-dashed border-[color-mix(in_srgb,var(--cds-gray-810)_30%,transparent)] dark:border-[color-mix(in_srgb,var(--cds-gray-100)_30%,transparent)]";
var wf="shadow-[0_0.25rem_1.25rem_color-mix(in_srgb,var(--cds-black)_3.5%,transparent)]";
var Tf="focus-within:shadow-[0_0.25rem_1.25rem_color-mix(in_srgb,var(--cds-black)_7.5%,transparent)]";
var Ef="(?:\\d|\\[|xs|sm|md|lg|xl|2xl|3xl|none|px|full|card|chip)";
var Df="rounded(?:-(?:[setlrb]{1,2}|ss|se|es|ee))?(?:-"+Ef+"|\\b)";
var Of="p(?:x|[lrse])?-"+Ef;
var kf="p(?:y|[tb])?-"+Ef;
var Af="gap(?:-y)?-"+Ef;
var jf=new Map;
function Mf(e,t,n){let r="(?:^|\\s)"+t+n,i=jf.get(r);return i===void 0&&(i=new RegExp(r),jf.set(r,i)),i.test(e)}
var Nf={dropFilesHere:"Drop files here",replyPlaceholder:"Reply"};
function If(e,t,n){if(t===void 0&&n===void 0)return e;let{"aria-label":r,"aria-labelledby":i,...a}=e??{};return{...a,...t!==void 0&&{"aria-label":t},...n!==void 0&&{"aria-labelledby":n}}}
function Lf({draftStoreKey:e,hasDraftText:t,hasDraftContent:n,busy:r,pinSend:i,form:a,children:o}){let[s,c]=_(null),[l,u]=_(e);l!==e&&(u(e),c(null));let d=(s??t())||n,f=H(()=>({hasContent:d,busy:r,pinSend:i,form:a}),[d,r,i,a]);return k(ci.Provider,{value:c,children:k(jr.Provider,{value:f,children:o})})}
var Rf=B(({multiline:e,busy:t,pinSend:n,disabled:r,variant:i,form:a="new",onFileDrop:o,fileDropDisabled:s,dropScope:c,dropLabel:l,hasDraftContent:d,onClusterWidthsChange:f,motion:p,className:m,cardClassName:h,editor:g,"aria-label":v,"aria-labelledby":x,children:S,...C},T)=>{let E=g.draftStoreKey,[O,A]=_(!1),[j,F]=_(E);j!==E&&(F(E),A(!1));let L=g.onMeasureTarget,[R,z]=_(null),ee=N(e=>{z(e),L?.(e)},[L]),{headers:B,attachments:V,actions:U,chin:te,overlays:ne,tray:W,hasNonPart:G}=H(()=>lf(S),[S]),re=!1,K=!1,q=!1,ie="base";for(let e of U)if(w(e)){let t=e.props;t.gap==="tight"&&(ie="tight"),re||=Vd(t),K||=Bd(t),q||=Hd(t)}let ae=Rd("leading"),oe=Rd("trailing"),se=Rd("send"),J=ae.width,ce=oe.width,le=H(()=>({leadingRef:ae.ref,trailingRef:oe.ref,sendRef:se.ref}),[ae.ref,oe.ref,se.ref]),ue=re?J??jd:0,de=K?ce??Md:0,[Y,fe]=zd(de,!re),pe=!re&&fe,me=co(f),he=re?J:0,ge=K?ce:0,_e=q?se.width:0,ve=D(null);b(()=>{let e=re?ae.latest.current:0,t=K?oe.latest.current:0,n=q?se.latest.current:0;if(me===void 0){ve.current=null;return}if(e===null||t===null||n===null)return;let r=ve.current;(r===null||r.leading!==e||r.trailing!==t||r.send!==n)&&(ve.current={leading:e,trailing:t,send:n},me({leading:e,trailing:t,send:n}))},[me,re,K,q,ae.latest,oe.latest,se.latest,he,ge,_e]);let ye=V.some(uf),be=B.some(uf),[xe,Se]=_(!1),[Ce,we]=_(be);Ce!==be&&(we(be),Se(!be));let Te=be||xe,Ee=N(()=>{Se(!1)},[]),De=Gr(g.minLines),[Oe,X]=_(De);Oe!==De&&(X(De),e===void 0&&A(!1));let ke=e??(ye||De),Ae=od({editorEl:R,enabled:e===void 0&&!De,reservedWidthPx:ue+(pe?0:de),resetKey:E,contentKey:g.contentKey,columnIsTwoRow:ke}),je=e??(ke||Ae),Me=re?je?"glyph":"none":"text",Ne=u(_t).setComposerStartInset;xa(()=>{if(Ne!==void 0)return Ne(Me),()=>Ne(void 0)},[Ne,Me]);let Pe=K&&(pe||!je)?"actions":"none",Fe=pe||g.trailingNotch==="pad",Ie=H(()=>({multiline:je,startInset:Me,endInset:Pe,glideArmed:O,columnReservesTrailing:Fe}),[je,Me,Pe,O,Fe]),Le=D(null);b(()=>{let e=Ua(R);if(!R||e===void 0)return;let t="",n=()=>{let e=R.children,t=e.length===0?R.offsetHeight:e[e.length-1].getBoundingClientRect().bottom-e[0].getBoundingClientRect().top,n=R.parentElement?.querySelectorAll(":scope > [data-composer-placeholder-ghost]"),r=t;return n?.forEach(e=>{r=Math.max(r,e.offsetHeight)}),r},r=()=>{let e=`${Math.ceil(n())}px`,r=Le.current;r&&e!==t&&(r.style.setProperty("--cmp-wrap-h",e),t=e)},i=$a(e,r);i.observe(R);let a=0,o=typeof MutationObserver>"u"?void 0:Pa(MutationObserver,()=>{a===0&&(a=requestAnimationFrame(()=>{a=0,r()}))});return o?.observe(R,{childList:!0,subtree:!0,characterData:!0}),R.parentElement&&o?.observe(R.parentElement,{childList:!0,attributes:!0,attributeFilter:["data-composer-placeholder-ghost"]}),()=>{i.disconnect(),o?.disconnect(),a!==0&&cancelAnimationFrame(a)}},[R]);let Re=H(()=>({"--cmp-lead-w":`${ue}px`,"--cmp-trail-w":`${de}px`}),[ue,de]);b(()=>{if(!R||O)return;let e=0,t=requestAnimationFrame(()=>{e=requestAnimationFrame(()=>A(!0))});return()=>{cancelAnimationFrame(t),e!==0&&cancelAnimationFrame(e)}},[R,O]),b(()=>{if(O)return;let e=setTimeout(()=>A(!0),1e3);return()=>clearTimeout(e)},[O]);let ze=D(null),Be=vd({targetRef:ze,onFileDrop:o,disabled:s,scope:c}),Ve=ia(),He=So(ze),Ue=!!(r||g.disabled),We=g.extraEditorAttributes,Ge=H(()=>If(We,v,x),[We,v,x]),Ke=g.render,Je=H(()=>Ke({disabled:Ue,onMeasureTarget:ee,extraEditorAttributes:Ge}),[Ke,Ue,ee,Ge]),Ye=g.focus,Xe=g.storeCaret,Ze=D(null),Qe=D(!1),$e=D(!1),{clickToFocusProps:et}=sa(()=>{let e=Ze.current;e&&hd(R,e.x,e.y,Xe)||Qe.current||Ye()},{disabled:Ue,shouldIgnoreTarget:Nd}),tt=et.onMouseDown,nt=H(()=>({onMouseDown:e=>{let t=Pd(e.target)?e.target:null;if(t&&!R?.isContentEditable||Id(e,R))return;let n=e.shiftKey||e.ctrlKey||e.metaKey||e.altKey||$e.current;if(n&&t&&R?.ownerDocument.activeElement!==R)return;Qe.current=t!==null;let r=t?.getBoundingClientRect(),i=r?Math.min(Math.max(e.clientY,r.top),r.bottom-1):e.clientY;Ze.current=n?null:{x:e.clientX,y:i},tt(e)},onCompositionStartCapture:()=>{$e.current=!0},onCompositionEndCapture:()=>{$e.current=!1}}),[tt,R]),rt=Be==="off-target"||Be==="on-target",it=c==="card"&&Be==="on-target",at=oo("dropFilesHere",Nf.dropFilesHere),ot=l??at,st=p!==void 0,[ct]=_(()=>g.handoffCard),lt=D(st),ut=Uu();b(()=>{},[st,ut]),b(()=>{lt.current=st},[st]);let dt=h??"",ft=e=>Mf(dt,"(?:(?:comfortable|compact):)?",e),pt=ft(Df),ht=ft(Of),gt=ft(kf),vt=ft(Af);b(()=>{},[dt]);let yt=te.length>0,bt=te.length;b(()=>{},[bt]);let xt=W.length;b(()=>{},[xt]),b(()=>{},[ht,yt]);let St=$i(!ht&&vf,!gt&&yf),Ct=$i(I(Wu,ff,"relative z-[1] flex w-full min-w-0 flex-col text-primary"),!pt&&"rounded-composer",!ht&&hf,!gt&&gf,"[--cmp-gap-y:0.375rem] compact:[--cmp-gap-y:0.375rem] comfortable:[--cmp-gap-y:0.5rem]",!vt&&"gap-y-[var(--cmp-gap-y)]",Pr,O?"transition-[background-color,border-color,box-shadow,opacity] duration-200":"transition-none",i==="incognito"?I(Cf,wf,Tf):c==="card"&&rt?"shadow-none":I(bf,!Ue&&xf,Sf),Ue?"cursor-default":"cursor-text",h),wt=P(M,{children:[k(rs,{initial:!1,onExitComplete:Ee,children:be?k(rs.Div,{className:I("grid grid-rows-[1fr] overflow-hidden",!vt&&"-mb-[var(--cmp-gap-y)]"),enterClassName:Ou,exit:{height:0},children:k("div",{className:"min-h-0 min-w-0",children:k("div",{className:I(!vt&&"pb-[var(--cmp-gap-y)]"),children:B})})},"header"):null}),ye?k("div",{"data-cds-composer-attachments-clip":"",className:I("-mx-2 grid grid-rows-[1fr] overflow-hidden px-2",!gt&&!Te&&_f),children:k("div",{"data-cds-composer-attachments":"",className:"min-h-0 min-w-0 px-1 pt-1 pb-2.5",children:k(ko.Provider,{value:He,children:V})})}):null,P("div",{ref:Y,className:"relative w-full min-w-0",style:Re,children:[k("div",{ref:Le,className:I("w-full min-w-0",O&&Od,pe?ni:je?(re||K)&&(ie==="tight"?"pb-[calc(var(--cds-h-control)+0.125rem)]":"pb-[calc(var(--cds-h-control)+var(--cmp-gap-y))]"):["pl-[var(--cmp-lead-w)]",g.trailingNotch==="float"?"[&_.ProseMirror]:before:float-right [&_.ProseMirror]:before:content-[''] [&_.ProseMirror]:before:h-[var(--cmp-wrap-h,20px)] [&_.ProseMirror]:before:w-[var(--cmp-trail-w)] [&_.ProseMirror]:before:[shape-outside:inset(calc(100%-var(--cmp-row-h))_0_0_0)]":ni]),children:P("div",{className:"relative min-w-0 break-words",children:[Je,ne]})}),U]}),W.length>0?k(rf.Provider,{value:St,children:W}):null,k(rs,{initial:!1,children:c==="card"&&rt?P(rs.Div,{"data-cds":"ChatComposerDropPanel","aria-hidden":"true",exit:{opacity:0,scale:.95},transition:{duration:.2},style:bd,className:"pointer-events-none absolute inset-0 z-[1] rounded-[inherit]",enterClassName:ku,children:[k("div",{"aria-hidden":"true",className:I("absolute inset-0 rounded-[inherit] transition-opacity duration-fast",Be==="on-target"?"opacity-0":"opacity-100",Sd)}),k("div",{"aria-hidden":"true",className:I("absolute inset-0 rounded-[inherit] transition-opacity duration-fast",Be==="on-target"?"opacity-100":"opacity-0",xd)}),k("div",{"aria-hidden":"true",className:I("absolute inset-0 rounded-[inherit] transition-opacity duration-fast",Be==="on-target"?"opacity-100":"opacity-0",Cd,ju)})]},"chat-composer-drop-panel"):null})]});return k(yd.Provider,{value:Ie,children:k(Lf,{draftStoreKey:E,hasDraftText:g.hasDraftText,hasDraftContent:!!d,busy:!!t,pinSend:!!n,form:a,children:k(Ad.Provider,{value:le,children:P("div",{ref:T,"data-cds":"ChatComposer",[mt]:"","data-variant":i==="default"?void 0:i,"data-form":a==="new"?void 0:a,"data-multiline":je||void 0,"data-start-inset":Me==="none"?void 0:Me,"data-end-inset":Pe==="none"?void 0:Pe,"data-actions-gap":ie==="base"?void 0:ie,"data-busy":t||void 0,"data-disabled":Ue||void 0,"data-drag-over":it||void 0,className:$i("flex w-full min-w-0 flex-col font-sans",qe,m),...C,children:[p!==void 0&&ct!==void 0?k(ct,{ref:ze,layoutId:p.layoutId,layoutDependency:p.layoutDependency,transition:p.transition,className:Ct,onMouseDown:nt.onMouseDown,onCompositionStartCapture:nt.onCompositionStartCapture,onCompositionEndCapture:nt.onCompositionEndCapture,children:wt}):k("div",{ref:ze,className:Ct,onMouseDown:nt.onMouseDown,onCompositionStartCapture:nt.onCompositionStartCapture,onCompositionEndCapture:nt.onCompositionEndCapture,children:wt}),c==="page"&&rt&&Ve?y(k(Dd,{dropLabel:ot}),Ve.document.body):null,te]})})})})});

export { Rf, lf, df, nf, yd, Wd, Ad, kd, Hd, gd, Vd, Bd, Ud, Pu, Nu, Fu, Iu, ef, Qd, ff, mf, pf, Yd, Jd, Gd, Kd, qd, Xd, $d, Zd, cf, of, tf, af, rf, Rd, Ld, jd, Md, zd, uf, od, Qu, $u, Zu, Yu, Ju, ed, rd, nd, td, Xu, qu, id, ad, vd, _d, If, hd, ld, pd, fd, dd, cd, ud, sd, md, Nd, Pd, Id, Fd, Nf, Uu, Hu, Mf, jf, Df, Ef, Of, kf, Af, vf, yf, Wu, hf, gf, Cf, wf, Tf, bf, Gu, xf, Sf, Ou, _f, Od, bd, ku, Sd, xd, Cd, ju, Lf, Dd, wd, Au, Td, Ed, Mu, B, _, N, H, L, w, u, Kr, Qi, k, $i, Lr, ho, jr, R, xa, F, P, _a, z, A, I, E, fo, aa, za, D, Pa, la, ca, Wr, Ur, Ua, $a, b, zr, co, Gr, Ga, ha, ba, _t, ia, Ea, So, sa, Za, oo, Pr, M, rs, ko, Mr, ni, ci, mt, qe, y, Sa, ro, Na, ai, Br };
