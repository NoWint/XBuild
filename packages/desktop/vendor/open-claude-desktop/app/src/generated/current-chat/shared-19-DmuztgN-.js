// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { D as M } from "./vendor-frame-foKw4lFA.js";
import { useHomePermissions as qr } from "../../source-home-adapters.jsx";
import { Fb as xd } from "./shared-100-Bs3K3KCN.js";
import { useHomeReviewDelay as $s } from "../../source-home-adapters.jsx";
import { homeSessionHasInlineReview as ke } from "../../source-home-adapters.jsx";
import { useHomeAnalytics as wu } from "../../source-home-adapters.jsx";
import { useHomePins as Ds } from "../../source-home-adapters.jsx";
import { useHomeNow as di } from "../../source-home-adapters.jsx";
import { eN as Ap } from "./shared-2-DtKYxnkM.js";
import { M as D } from "./vendor-frame-foKw4lFA.js";
import { homeSessionOpened as jp } from "../../source-home-adapters.jsx";
import { me as O } from "./vendor-frame-foKw4lFA.js";
import { ge as A } from "./vendor-frame-foKw4lFA.js";
import { K as S } from "./vendor-frame-foKw4lFA.js";
import { HomeLink as Fo } from "../../source-home-adapters.jsx";
import { SourceIcon as $f } from "../../source-chat-adapters.jsx";
import { HomeSessionStatus as Gr } from "../../source-home-adapters.jsx";
import { useHomePins as fu } from "../../source-home-adapters.jsx";
import { useHomeNeedsAttention as J_ } from "../../source-home-adapters.jsx";
import { LocalizedMessage as X } from "../../source-chat-adapters.jsx";
import { $t as Jh } from "../chat/vendor-intl-Cf4IuK3L.js";
import { UnavailableInlineReview as Ef } from "../../source-home-adapters.jsx";
import { HostButton as ep } from "../../source-chat-adapters.jsx";
import { h as T } from "./vendor-frame-foKw4lFA.js";
import { UnavailableInlineReview as J } from "../../source-home-adapters.jsx";
import { UnavailableInlineReview as AI } from "../../source-home-adapters.jsx";
import { n_ as Hf } from "./shared-frame-DVFSKIcx.js";
var VA=1.25;
var HA="clamp(1.875rem, 1.2rem + 2vw, 2.375rem)";
var UA=1.2;
var WA="clamp(1.5rem, 1.15rem + 1vw, 2rem)";
function GA(e){return e==="compact"?{lineHeight:UA,fontSize:WA}:{lineHeight:VA,fontSize:HA}}
var qA="my-3 w-full";
var JA="mt-3 w-full";
var YA="text-primary text-balance text-center";
var XA="font-display";
var ZA="font-ui-serif font-[360] dark:[font-variation-settings:'wght'_320]";
var QA="me-[0.3em] inline-block size-[0.72em] supports-[height:1cap]:size-[1cap] [&>svg]:block [&_svg]:scale-[1.333] max-sm:-ms-[0.84em]";
var $A="max-sm:px-[0.96em]";
var ej="me-[0.45em] inline-block size-[0.72em] supports-[height:1cap]:size-[1cap] [&>svg]:block [&_svg]:scale-[1.4] max-sm:-ms-[0.84em]";
var tj="sm:pe-[calc((0.72em+0.45em)/2)] sm:supports-[height:1cap]:pe-[calc((1cap+0.45em)/2)]";
function nj(e){return[YA,e==="compact"?ZA:XA,$A,...e==="compact"?[tj]:[]].join(" ")}
function rj(e){return e==="compact"?ej:QA}
var ij="pt-[calc(var(--prerender-activation-viewport-height,100vh)*0.1)] md:pt-[calc(var(--prerender-activation-viewport-height,100vh)*0.25)]";
var aj="pt-[calc(var(--prerender-activation-viewport-height,100vh)*0.1)] md:pt-[max(var(--prerender-activation-viewport-height,100vh)*0.28+0.56875rem,12rem)] md:[@media(min-height:900px)]:[html:not([data-prerender-headroom-arm])_&]:pt-[calc(var(--prerender-activation-viewport-height,100vh)*0.32+0.56875rem)] md:[html[data-prerender-headroom-arm=tall]_&]:pt-[calc(var(--prerender-activation-viewport-height,100vh)*0.32+0.56875rem)]";
var cj="!mt-[calc(-1*min(var(--organization-banner-column-height,0px),var(--prerender-activation-viewport-height,100vh)*0.25))] h-[calc(100%+min(var(--organization-banner-column-height,0px),var(--prerender-activation-viewport-height,100vh)*0.25))]";
var lj={classic:{columnTopOffsetClass:ij,greetingLockup:"inline",greetingSlotClass:qA,greetingPhoneSeat:"center"},home:{columnTopOffsetClass:aj,greetingLockup:"compact",greetingSlotClass:JA,greetingPhoneSeat:"top"}};
function uj(e){return lj[e]}
var fj="dock:h-auto dock:min-h-[calc(100%+min(var(--organization-banner-column-height,0px),var(--prerender-activation-viewport-height,100vh)*0.25))]";
var Ej="dock:mt-0 dock:mb-0 dock:pt-[max(0px,calc(var(--app-visual-viewport-height,100dvh)*0.5_-_var(--prerender-activation-viewport-height,100vh)*0.1_-_6.5625rem))]";
function Dj(e){return e==="center"?Ej:""}
var OI=M(({className:e})=>S("span",{className:A("flex h-2 w-2 flex-shrink-0 items-center justify-center",e),"aria-hidden":"true",children:S("span",{className:"h-2 w-2 animate-pulse-dot motion-reduce:animate-none rounded-full bg-border"})}));
var kI=M(({isRunning:e,sessionId:t,isUnread:n})=>J_(t)?S("span",{className:"h-2 w-2 flex-shrink-0 rounded-full bg-fill-accent",role:"status","aria-label":"Needs attention"}):e?S("span",{role:"status","aria-label":"Session running",children:S(OI,{})}):n?S("span",{className:"h-2 w-2 flex-shrink-0 rounded-full bg-fill-accent",role:"status","aria-label":"Unread activity"}):null);
var jI=M(({session:e,isUnread:t,compact:n=!1,href:r,openedSource:i="task_overview",hideReview:a=!1})=>{let{pending:o,needsUserAction:s,hasOnlyInputRequests:c,canShowReviewPopover:l}=qr(e.sessionId),u=xd(e,s,o.length>0),d=u==="awaiting",f=$s(d&&!ke(e.sessionId)),{track:p}=wu(),m=Ds(),h=r??`/cowork/${e.sessionId}`,g=e.title??"Local task",_=di(),v=e.lastActivityAt??e.createdAt??0,y=v?Math.min(0,Math.round((v-_)/1e3)):0,b=Ap(e),x=b&&t,C=e.isStarred&&u==="idle"&&!e.error&&!x,w=D(()=>{jp(e.sessionId),p({event_key:"claudeai.cowork.session.opened",session_id:e.sessionId,source:i,has_pending_permissions:d,is_running:e.isRunning,is_unread:t})},[e.sessionId,e.isRunning,d,t,p,i]);return O("div",{className:A("relative flex items-center px-2",n?"gap-2 py-2":"gap-3 py-3","hover:bg-fill-ghost-hover hover:rounded-lg","group"),children:[S(Fo,{href:h,onClick:w,"aria-label":g,className:"absolute inset-0 rounded-lg"}),O("div",{className:A("flex flex-1 min-w-0 pointer-events-none",n?"gap-2":"gap-3","items-center"),children:[S("div",{className:"flex-shrink-0 flex justify-center w-7",children:C&&m?S($f,{name:"Pin",size:"md",className:"text-muted"}):S(Gr,{sessionId:e.sessionId,liveStatus:u,isDone:b,isUnread:t,hasError:!!e.error,errorCategory:e.errorCategory,isScheduledTask:!!e.scheduledTaskId})}),O("div",{className:"flex-1 min-w-0 flex flex-col gap-0.5",children:[O("div",{className:"flex items-center gap-1.5",children:[S("span",{className:A("min-w-0 truncate","text-sm",t?"text-primary":"text-secondary"),children:g}),!m&&e.isStarred&&S($f,{name:"StarFilled",size:"sm",className:"text-muted"}),e.scheduledTaskId&&fu()&&S($f,{name:"Clock",size:"sm",className:"text-muted"}),!d&&!e.isRunning&&S("div",{className:"flex-shrink-0 w-3 flex items-center justify-center",children:S(kI,{isRunning:e.isRunning,sessionId:e.sessionId})})]}),!n&&O("span",{className:"text-xs text-muted",children:[d&&(c?S(X,{defaultMessage:"Needs attention",id:"J8cAGGisOh"}):S(X,{defaultMessage:"Permissions needed",id:"sj1qWyUHZh"})),S("span",{className:A("first-letter:capitalize",d&&"before:content-['\u00B7'] before:mx-1 before:text-text-500/50"),children:S(Jh,{value:y,numeric:"auto",updateIntervalInSeconds:60})})]})]})]}),d&&!a&&!f?l?S("div",{className:A("relative z-10",n&&"-my-0.5"),children:O(Ef.Root,{children:[S(Ef.Trigger,{render:S(ep,{variant:"secondary",size:"sm",children:S(X,{defaultMessage:"Review",id:"R+J5oxt1Fc"})})}),S(Ef.Popup,{side:"left",align:"start",sideOffset:8,collisionPadding:16,padding:"none",className:"max-w-[30rem]",children:S(T,{fallback:O("div",{className:"w-[30rem] p-4 flex flex-col gap-3",children:[S(J,{height:20,width:"60%"}),S(J,{height:64,className:"rounded-lg"}),S(J,{height:36,width:"40%"})]}),children:S(AI,{sessionId:e.sessionId,permissions:o,isScheduledTask:!!e.scheduledTaskId,source:"task_overview",sessionHref:h,onOpenSession:w})})})]})}):S(ep,{variant:"secondary",size:"sm",className:A("relative z-10 pointer-events-none",n&&"-my-0.5"),children:S(X,{defaultMessage:"Review",id:"R+J5oxt1Fc"})}):n?S("span",{className:"pointer-events-none shrink-0 text-caption text-muted opacity-0 first-letter:capitalize group-hover:opacity-100 group-focus-within:opacity-100",children:S(Jh,{value:y,numeric:"auto",updateIntervalInSeconds:60})}):S($f,{name:"CaretRight",size:"md",className:"pointer-events-none invisible text-muted group-hover:visible"})]})});
function MI(){return{bgFill:Hf.surface[2].cssVar,accentFill:`light-dark(${Hf.neutral[50].cssVar}, ${Hf.neutral[250].cssVar})`,stroke:Hf.neutral[350].cssVar,borderStroke:Hf.neutral[350].cssVar,textStroke:`light-dark(${Hf.text.muted.cssVar}, ${Hf.text.secondary.cssVar})`,docTextStroke:`light-dark(${Hf.neutral[350].cssVar}, ${Hf.text.secondary.cssVar})`,panelFill:`light-dark(${Hf.surface[2].cssVar}, transparent)`,dotsFill:Hf.neutral[50].cssVar}}
var NI;
function PI(){return NI??=MI(),NI}

export { jI, kI, OI, PI, MI, NI, GA, UA, WA, VA, HA, nj, YA, ZA, XA, $A, tj, rj, ej, QA, uj, lj, ij, qA, aj, JA, cj, fj, Dj, Ej, M, qr, xd, $s, ke, wu, Ds, di, Ap, D, jp, O, A, S, Fo, $f, Gr, fu, J_, X, Jh, Ef, ep, T, J, AI, Hf };
