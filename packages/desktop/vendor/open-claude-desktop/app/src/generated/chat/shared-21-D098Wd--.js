// Extracted from Claude Desktop 2.2553.1 shared-21-D098Wd--.js. Only asset URLs are made relative. Do not edit.
import { GE as na } from "./shared-9-Zi4BzzJw.js";
import { IE as sa } from "./shared-9-Zi4BzzJw.js";
import { useRoutineIntl as Z } from "../../source-routine-adapters.jsx";
import { useRoutineAnalytics as Gr } from "../../source-routine-adapters.jsx";
import { useRoutineErrors as Ko } from "../../source-routine-adapters.jsx";
import { useRoutineBridge as sh } from "../../source-routine-adapters.jsx";
import { FD as Ui } from "./shared-9-Zi4BzzJw.js";
import { noRemoteModel as ta } from "../../source-routine-adapters.jsx";
import { noRemoteModel as qi } from "../../source-routine-adapters.jsx";
import { useMemo as w } from "react";
import { unavailableMigration as Yi } from "../../source-routine-adapters.jsx";
import { useCallback as k } from "react";
import { en as Y } from "./vendor-intl-Cf4IuK3L.js";
import { RD as Li } from "./shared-9-Zi4BzzJw.js";
import { jsx as A } from "react/jsx-runtime";
import { HostButton as Ds } from "../../source-chat-adapters.jsx";
import { LE as la } from "./shared-9-Zi4BzzJw.js";
import { jsxs as P } from "react/jsx-runtime";
import { RoutineSourceMenu as J } from "../../source-routine-adapters.jsx";
import { HostTooltip as Xs } from "../../source-chat-adapters.jsx";
import { LocalizedMessage as X } from "../../source-chat-adapters.jsx";
import { UnavailableRoutineBadge as zV } from "../../source-routine-adapters.jsx";
import { Fragment as D } from "react";
import { useDesktopFrame as vm } from "../../source-chat-adapters.jsx";
import { classNames as M } from "../../source-chat-adapters.jsx";
import { homeTone as _O } from "../../source-home-adapters.jsx";
import { HomeIcon as nc } from "../../source-home-adapters.jsx";
import { HomeStatusDot as fO } from "../../source-home-adapters.jsx";
var ub="pt-[calc(var(--prerender-activation-viewport-height,100vh)*0.1)] md:pt-[calc(var(--prerender-activation-viewport-height,100vh)*0.25)]";
var db="pt-[calc(var(--prerender-activation-viewport-height,100vh)*0.1)] md:pt-[max(var(--prerender-activation-viewport-height,100vh)*0.28+0.56875rem,12rem)] md:[@media(min-height:900px)]:[html:not([data-prerender-headroom-arm])_&]:pt-[calc(var(--prerender-activation-viewport-height,100vh)*0.32+0.56875rem)] md:[html[data-prerender-headroom-arm=tall]_&]:pt-[calc(var(--prerender-activation-viewport-height,100vh)*0.32+0.56875rem)]";
var mb="!mt-[calc(-1*min(var(--organization-banner-column-height,0px),var(--prerender-activation-viewport-height,100vh)*0.25))] h-[calc(100%+min(var(--organization-banner-column-height,0px),var(--prerender-activation-viewport-height,100vh)*0.25))]";
var hb=1.25;
var gb="clamp(1.875rem, 1.2rem + 2vw, 2.375rem)";
var _b=1.2;
var vb="clamp(1.5rem, 1.15rem + 1vw, 2rem)";
function yb(e){return e==="compact"?{lineHeight:_b,fontSize:vb}:{lineHeight:hb,fontSize:gb}}
var bb="mx-auto flex w-full flex-col items-center gap-7 max-md:pt-4 max-w-2xl";
var xb="my-3 w-full";
var Sb="mt-3 w-full";
var Cb="text-primary text-balance text-center";
var wb="font-display";
var Tb="font-ui-serif font-[360] dark:[font-variation-settings:'wght'_320]";
var Eb="me-[0.3em] inline-block size-[0.72em] supports-[height:1cap]:size-[1cap] [&>svg]:block [&_svg]:scale-[1.333] max-sm:-ms-[0.84em]";
var Db="max-sm:px-[0.96em]";
var Ob="me-[0.45em] inline-block size-[0.72em] supports-[height:1cap]:size-[1cap] [&>svg]:block [&_svg]:scale-[1.4] max-sm:-ms-[0.84em]";
var kb="sm:pe-[calc((0.72em+0.45em)/2)] sm:supports-[height:1cap]:pe-[calc((1cap+0.45em)/2)]";
function Ab(e){return[Cb,e==="compact"?Tb:wb,Db,...e==="compact"?[kb]:[]].join(" ")}
function jb(e){return e==="compact"?Ob:Eb}
var Mb={classic:{columnTopOffsetClass:ub,greetingLockup:"inline",greetingSlotClass:xb,greetingPhoneSeat:"center"},home:{columnTopOffsetClass:db,greetingLockup:"compact",greetingSlotClass:Sb,greetingPhoneSeat:"top"}};
function Nb(e){return Mb[e]}
var Fb="dock:h-auto dock:min-h-[calc(100%+min(var(--organization-banner-column-height,0px),var(--prerender-activation-viewport-height,100vh)*0.25))]";
var Yb="dock:mt-0 dock:mb-0 dock:pt-[max(0px,calc(var(--app-visual-viewport-height,100dvh)*0.5_-_var(--prerender-activation-viewport-height,100vh)*0.1_-_6.5625rem))]";
function Xb(e){return e==="center"?Yb:""}
function Lx({children:e,className:t,narrow:n}){let r=vm()?"div":"main";return A(r,{className:M("mx-auto mt-4 w-full flex-1 px-md md:px-8 lg:mt-6",n?"max-w-4xl":"max-w-7xl",t),children:e})}
function jw(e,t,n){let r=na(e,t);return n&&(r==="paused"||r==="active")?"on-hold":r}
function iO(e){e.buttons===0&&e.stopPropagation()}
function aO({label:e,detail:t,live:n=!1,tooltip:r=!0,triggerClassName:i="",children:a}){let o=A("span",{role:n?"status":"img","aria-label":e,className:`flex min-h-3.5 min-w-3.5 shrink-0 items-center justify-center ${i}`,onPointerMove:iO,onPointerEnter:iO,onMouseMove:iO,children:a});return r?A(Xs,{content:e,detail:t,delay:500,closeDelay:0,hoverable:!1,lazy:!0,className:"pointer-events-none",children:o}):o}
var cO="[mask-image:radial-gradient(circle_at_calc(100%_-_1px)_4px,transparent_5px,black_5.5px)]";
var lO="[mask-image:radial-gradient(circle_at_calc(100%_-_1px)_4px,transparent_6.5px,black_7px)]";
var uO={ChatSimple:14};
function dO({name:e,dot:t}){let n=uO[e],r=t==="error",i=_O(hO);return P("span",{className:"relative inline-flex",children:[A(nc,{name:e,...n===void 0?{size:"auto"}:{customSize:n},className:M("text-muted",t&&(r?lO:cO))}),t&&(r?A("span",{"aria-hidden":!0,className:"absolute -top-px -right-1",children:A(nc,{name:"Warning",customSize:10,className:i})}):A("span",{"aria-hidden":!0,className:"absolute top-px -right-0.5",children:A(fO,{kind:t})}))]})}
var hO="text-warning";
function MV(e){return e.fireAt?e.source==="remote"?e.endedReason===sa:!!e.lastRunAt:!1}
function NV(e){let t=jw(e.enabled,e.endedReason,e.suspensionReason);return t==="auto-disabled"||t==="on-hold"?t:t==="completed"||MV(e)?"completed":"paused"}
var PV=Y({oneShotTimePassed:{defaultMessage:"This one-time task\u2019s scheduled time has passed, so it can\u2019t be turned back on here. Run it now or create a new task.",id:"bGAI/nQBDE"},failed:{defaultMessage:"Schedule couldn\u2019t be enabled. You can try again.",id:"2ri4T6QHSG"}});
function FV(e){return e.source==="remote"&&!e.cronExpression&&e.fireAt!==void 0&&!MV(e)}
function IV(e,t){return FV(e)&&!e.enabled&&e.fireAt!==void 0&&e.fireAt<=t}
function LV(e,t){e(t.formatMessage(PV.oneShotTimePassed))}
function RV(e,t,n){e(t.formatMessage(PV.failed),{error:n,errorContext:{tags:{source:"scheduled_task_enable"}},messageForLogging:"Cowork scheduled task enable IPC failed."})}
var BV=Y({no_prompt:{defaultMessage:"Can\u2019t move this task because its file couldn\u2019t be read.",id:"74ayq7gcmk"},local_folders:{defaultMessage:"Can\u2019t move this task because it uses local folders or files.",id:"JfHCDRUf+C"},projects:{defaultMessage:"Can\u2019t move this task yet. Moving would disconnect it from its projects. To run it in the cloud, create a new task instead.",id:"9C5nL0oRXk"},space:{defaultMessage:"This task uses a project on this computer, so it can only run here. To use the cloud, create a new task without it.",id:"es3vTUUA4o"},chrome:{defaultMessage:"Can\u2019t move this task because it uses Claude in Chrome.",id:"+JntkchELp"},cwd:{defaultMessage:"Can\u2019t move this task because it uses a local working directory.",id:"Rndy8UVBtI"},dispatch_hook:{defaultMessage:"Can\u2019t move this task because it notifies a local dispatch session.",id:"FJqKx2GjnF"},pattern_approvals:{defaultMessage:"Can\u2019t move this task because it has pattern-scoped tool approvals.",id:"co2lbYLIl3"},sub_hourly:{defaultMessage:"Can\u2019t move this task because cloud tasks run at most once per hour.",id:"S61gNMMIyj"},custom_cron:{defaultMessage:"Can\u2019t move this task because its schedule isn\u2019t supported.",id:"KzZeUGMhBo"}});
function VV({scheduledTask:e,onRunNow:t,isRunning:n,onEdit:r,onRename:i,onDelete:a,isDeleting:o=!1,onMigrate:s,isMigrating:c=!1,buttonSize:l="icon_sm",showRunNow:u=!0,showPauseToggle:d=!0,readState:f,trigger:p,triggerTooltip:m,open:h,onOpenChange:g}){let _=Z(),{track:v}=Gr(),{addError:y,addWarning:b}=Ko(),x=sh(),S=e.source??"local",C=!!e.cronExpression||FV(e),T=e.displayName??Ui(e.id),E=s!==void 0&&(c||S==="local"&&e.enabled),O=ta(),j=qi(),M=w(()=>E?c?{ok:!0}:Yi(e,{remoteFoldersSupported:O,remoteProjectsSupported:j}):null,[E,c,e,O,j]),N=k(async()=>{if(x?.updateScheduledTaskStatus){if(IV(e,Date.now())){LV(b,_);return}try{await x.updateScheduledTaskStatus(e.id,"enabled",void 0,S),v({event_key:"claudeai.cowork.scheduled_task.enabled",space_id:e.spaceId,task_kind:Li(e)})}catch(e){RV(y,_,e)}}},[x,e,S,v,y,b,_]),F=k(()=>{f&&(f.onToggle(),f.sessionId&&v({event_key:f.isUnread?"claudeai.cowork.session.marked_read":"claudeai.cowork.session.marked_unread",session_id:f.sessionId,source:"hover_menu"}))},[f,v]),I=k(async()=>{if(x?.updateScheduledTaskStatus)try{await x.updateScheduledTaskStatus(e.id,"disabled",void 0,S),v({event_key:"claudeai.cowork.scheduled_task.disabled",space_id:e.spaceId,task_kind:Li(e)})}catch(e){y(_.formatMessage({defaultMessage:"Schedule couldn\u2019t be paused. You can try again.",id:"iDNc35weoy"}),{error:e,errorContext:{tags:{source:"scheduled_task_disable"}},messageForLogging:"Cowork scheduled task disable IPC failed."})}},[x,e,S,v,y,_]),ee=A(Ds,{iconOnly:!0,icon:"DotsVertical",variant:"ghost",size:l==="icon"?void 0:"sm",tooltip:!1,className:"pointer-events-auto","aria-label":_.formatMessage({defaultMessage:"More options for {label}",id:"rKQPgfPvWS"},{label:T}),onClick:e=>{e.stopPropagation(),e.preventDefault()},onMouseDown:e=>{e.stopPropagation(),e.preventDefault()}}),L=e.endedReason===la;return P(J.Root,{open:h,onOpenChange:g,children:[m===void 0?A(J.Trigger,{render:p??ee}):A(Xs,{content:m,children:A(J.Trigger,{render:p??ee})}),P(J.Popup,{align:"end",children:[u&&!L&&A(J.Item,{icon:"Play",disabled:n||!e.prompt,onClick:t,children:A(X,{defaultMessage:"Run now",id:"v+MsvNCgFi"})}),d&&C&&!L&&A(J.Item,{icon:e.enabled?"Pause":"PlayCircle",onClick:e.enabled?()=>void I():()=>void N(),children:e.enabled?A(X,{defaultMessage:"Pause",id:"tFFMkFDBMO"}):A(X,{defaultMessage:"Enable",id:"TqSTI0/TZI"})}),f&&A(J.Item,{"data-testid":"toggle-scheduled-task-read-trigger",onClick:F,icon:f.isUnread?"Eye":"EyeSlash",children:f.isUnread?f.marksSeveral?A(X,{defaultMessage:"Mark all as read",id:"/af+jQ8xvW"}):A(X,{defaultMessage:"Mark as read",id:"64Hq/+q+KI"}):A(X,{defaultMessage:"Mark as unread",id:"vLAPJDu9y6"})}),i&&A(J.Item,{"data-testid":"rename-scheduled-task-trigger",icon:"Edit",onClick:()=>setTimeout(i,100),children:A(X,{defaultMessage:"Rename",id:"FPJlgifNwD"})}),A(J.Item,{icon:i?"Settings":"Edit",onClick:()=>setTimeout(r,100),children:A(X,{defaultMessage:"Edit",id:"wEQDC6Wv3/"})}),M&&A(Xs,{multiline:!0,side:"right",content:M.ok?A(zV,{migratesBound:(e.userSelectedFolders?.length??0)>0}):_.formatMessage(BV[M.reason]),children:A("div",{children:A(J.Item,{icon:"Cloud",disabled:!M.ok||c,onClick:M.ok&&!c?s:void 0,children:A(X,{defaultMessage:"Move to cloud",id:"Rl96x0Mg7A"})})})}),!L&&P(D,{children:[A(J.Separator,{}),A(J.Item,{variant:"danger",icon:"Trash",disabled:o,onClick:()=>setTimeout(a,100),children:A(X,{defaultMessage:"Delete",id:"K3r6DQW7h+"})})]})]})]})}
function _q(e,t){if(!t||e.includes("\\")||/^[A-Za-z]:/.test(e))return e;let n=t.endsWith("/")?t.slice(0,-1):t;if(e===n||e===n+"/")return"~";let r=n+"/";return e.startsWith(r)?"~/"+e.slice(r.length):e}

export { NV, jw, MV, VV, FV, IV, LV, PV, RV, BV, _q, Lx, Cb, Ab, Tb, wb, Db, kb, hb, yb, _b, vb, gb, jb, Ob, Eb, dO, uO, hO, lO, cO, aO, iO, Nb, Mb, ub, xb, db, Sb, bb, mb, Fb, Xb, Yb, na, sa, Z, Gr, Ko, sh, Ui, ta, qi, w, Yi, k, Y, Li, A, Ds, la, P, J, Xs, X, zV, D, vm, M, _O, nc, fO };
