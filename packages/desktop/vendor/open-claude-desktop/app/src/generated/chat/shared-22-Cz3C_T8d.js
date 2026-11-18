// Extracted from Claude Desktop 2.2553.1 shared-22-Cz3C_T8d.js. Only asset URLs are made relative. Do not edit.
import { memo as f } from "react";
import { useHomePermissions as Kn } from "../../source-home-adapters.jsx";
import { Ew as vf } from "./shared-4-D8W6lHTW.js";
import { useHomeAnalytics as Ga } from "../../source-home-adapters.jsx";
import { useHomePins as uc } from "../../source-home-adapters.jsx";
import { useHomeNow as kh } from "../../source-home-adapters.jsx";
import { $m as Lv } from "./shared-16-Cg1UfeMy.js";
import { useCallback as E } from "react";
import { homeSessionOpened as Uv } from "../../source-home-adapters.jsx";
import { jsxs as j } from "react/jsx-runtime";
import { classNames as k } from "../../source-chat-adapters.jsx";
import { jsx as D } from "react/jsx-runtime";
import { HomeLink as lo } from "../../source-home-adapters.jsx";
import { HomePin as ms } from "../../source-home-adapters.jsx";
import { HomeSessionStatus as Jn } from "../../source-home-adapters.jsx";
import { HomeStar as is } from "../../source-home-adapters.jsx";
import { useHomePins as as } from "../../source-home-adapters.jsx";
import { HomeClock as ec } from "../../source-home-adapters.jsx";
import { useHomeNeedsAttention as Ho } from "../../source-home-adapters.jsx";
import { LocalizedMessage as Y } from "../../source-chat-adapters.jsx";
import { $t as Kd } from "./vendor-intl-Cf4IuK3L.js";
import { UnavailableInlineReview as Ql } from "../../source-home-adapters.jsx";
import { HostButton as G } from "../../source-chat-adapters.jsx";
import { Suspense as M } from "react";
import { UnavailableInlineReview as K } from "../../source-home-adapters.jsx";
import { UnavailableInlineReview as _O } from "../../source-home-adapters.jsx";
import { HomeArrow as hc } from "../../source-home-adapters.jsx";
import { Ip as iu } from "./shared-frame-C_2npUJq.js";
var hO=f(({className:e})=>D("span",{className:k("flex h-2 w-2 flex-shrink-0 items-center justify-center",e),"aria-hidden":"true",children:D("span",{className:"h-2 w-2 animate-pulse-dot motion-reduce:animate-none rounded-full bg-border"})}));
var gO=f(({isRunning:e,sessionId:t,isUnread:n})=>Ho(t)?D("span",{className:"h-2 w-2 flex-shrink-0 rounded-full bg-fill-accent",role:"status","aria-label":"Needs attention"}):e?D("span",{role:"status","aria-label":"Session running",children:D(hO,{})}):n?D("span",{className:"h-2 w-2 flex-shrink-0 rounded-full bg-fill-accent",role:"status","aria-label":"Unread activity"}):null);
var vO=f(({session:e,isUnread:t,compact:n=!1,href:r,openedSource:i="task_overview",hideReview:a=!1})=>{let{pending:o,needsUserAction:s,hasOnlyInputRequests:c,canShowReviewPopover:l}=Kn(e.sessionId),u=vf(e,s,o.length>0),d=u==="awaiting",{track:f}=Ga(),p=uc(),m=r??`/cowork/${e.sessionId}`,h=e.title??"Local task",g=kh(),_=e.lastActivityAt??e.createdAt??0,v=_?Math.min(0,Math.round((_-g)/1e3)):0,y=Lv(e),b=y&&t,x=e.isStarred&&u==="idle"&&!e.error&&!b,S=E(()=>{Uv(e.sessionId),f({event_key:"claudeai.cowork.session.opened",session_id:e.sessionId,source:i,has_pending_permissions:d,is_running:e.isRunning,is_unread:t})},[e.sessionId,e.isRunning,d,t,f,i]);return j("div",{className:k("relative flex items-center px-2",n?"gap-2 py-2":"gap-3 py-3","hover:bg-fill-ghost-hover hover:rounded-lg","group"),children:[D(lo,{href:m,onClick:S,"aria-label":h,className:"absolute inset-0 rounded-lg"}),j("div",{className:k("flex flex-1 min-w-0 pointer-events-none",n?"gap-2":"gap-3","items-center"),children:[D("div",{className:"flex-shrink-0 flex justify-center w-7",children:x&&p?D(ms,{size:20,className:"text-muted"}):D(Jn,{sessionId:e.sessionId,liveStatus:u,isDone:y,isUnread:t,hasError:!!e.error,errorCategory:e.errorCategory,isScheduledTask:!!e.scheduledTaskId})}),j("div",{className:"flex-1 min-w-0 flex flex-col gap-0.5",children:[j("div",{className:"flex items-center gap-1.5",children:[D("span",{className:k("min-w-0 truncate","text-sm",t?"text-primary":"text-secondary"),children:h}),!p&&e.isStarred&&D(is,{size:12,className:k("flex-shrink-0","text-muted")}),e.scheduledTaskId&&as()&&D(ec,{size:12,className:k("flex-shrink-0","text-muted")}),!d&&!e.isRunning&&D("div",{className:"flex-shrink-0 w-3 flex items-center justify-center",children:D(gO,{isRunning:e.isRunning,sessionId:e.sessionId})})]}),!n&&j("span",{className:"text-xs text-muted",children:[d&&(c?D(Y,{defaultMessage:"Needs attention",id:"J8cAGGisOh"}):D(Y,{defaultMessage:"Permissions needed",id:"sj1qWyUHZh"})),D("span",{className:k("first-letter:capitalize",d&&"before:content-['\u00B7'] before:mx-1 before:text-text-500/50"),children:D(Kd,{value:v,numeric:"auto",updateIntervalInSeconds:60})})]})]})]}),d&&!a?l?D("div",{className:k("relative z-10",n&&"-my-0.5"),children:j(Ql.Root,{children:[D(Ql.Trigger,{render:D(G,{variant:"secondary",size:"sm",children:D(Y,{defaultMessage:"Review",id:"R+J5oxt1Fc"})})}),D(Ql.Popup,{side:"left",align:"start",sideOffset:8,collisionPadding:16,padding:"none",className:"max-w-[30rem]",children:D(M,{fallback:j("div",{className:"w-[30rem] p-4 flex flex-col gap-3",children:[D(K,{height:20,width:"60%"}),D(K,{height:64,className:"rounded-lg"}),D(K,{height:36,width:"40%"})]}),children:D(_O,{sessionId:e.sessionId,permissions:o,isScheduledTask:!!e.scheduledTaskId,source:"task_overview",sessionHref:m,onOpenSession:S})})})]})}):D(G,{variant:"secondary",size:"sm",className:k("relative z-10 pointer-events-none",n&&"-my-0.5"),children:D(Y,{defaultMessage:"Review",id:"R+J5oxt1Fc"})}):n?D("span",{className:"pointer-events-none shrink-0 text-caption text-muted opacity-0 first-letter:capitalize group-hover:opacity-100 group-focus-within:opacity-100",children:D(Kd,{value:v,numeric:"auto",updateIntervalInSeconds:60})}):D(hc,{size:16,className:"hidden group-hover:block flex-shrink-0 text-muted pointer-events-none"})]})});
function yO(){return{bgFill:iu.surface[2].cssVar,accentFill:`light-dark(${iu.neutral[50].cssVar}, ${iu.neutral[250].cssVar})`,stroke:iu.neutral[350].cssVar,borderStroke:iu.neutral[350].cssVar,textStroke:`light-dark(${iu.text.muted.cssVar}, ${iu.text.secondary.cssVar})`,docTextStroke:`light-dark(${iu.neutral[350].cssVar}, ${iu.text.secondary.cssVar})`,panelFill:`light-dark(${iu.surface[2].cssVar}, transparent)`,dotsFill:iu.neutral[50].cssVar}}
var bO;
function xO(){return bO??=yO(),bO}

export { vO, gO, hO, xO, yO, bO, f, Kn, vf, Ga, uc, kh, Lv, E, Uv, j, k, D, lo, ms, Jn, is, as, ec, Ho, Y, Kd, Ql, G, M, K, _O, hc, iu };
