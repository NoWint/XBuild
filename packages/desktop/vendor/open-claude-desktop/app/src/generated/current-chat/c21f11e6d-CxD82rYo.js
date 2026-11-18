// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { K as v } from "./vendor-frame-foKw4lFA.js";
import { N as _m } from "./cc5a62f6f-BgHG1Ree.js";
import { LocalizedMessage as Z } from "../../source-chat-adapters.jsx";
import { E as ym } from "./c4038fd41-DE0MYtnD.js";
import { D as E } from "./vendor-frame-foKw4lFA.js";
import { me as S } from "./vendor-frame-foKw4lFA.js";
import { pe as b } from "./vendor-frame-foKw4lFA.js";
function kx({src:e,darkSrc:t,width:n,height:r}){return S(b,{children:[v("div",{"aria-hidden":!0,className:"dark:hidden",style:{width:n,height:r},children:v("div",{className:"h-full bg-no-repeat",style:{backgroundImage:`url(${e})`}})}),v("div",{"aria-hidden":!0,className:"hidden dark:block",style:{width:n,height:r},children:v("div",{className:"h-full bg-no-repeat",style:{backgroundImage:`url(${t})`}})})]})}
var Ax=E(()=>v("div",{className:"-ml-3",children:v(kx,{src:"./images/illustrations/session-progress.svg",darkSrc:"./images/illustrations/session-progress-dark.svg",width:117,height:66})}));
var jx=E(()=>v(kx,{src:"./images/illustrations/session-artifacts.svg",darkSrc:"./images/illustrations/session-artifacts-dark.svg",width:63,height:43}));
var Nx=E(()=>S("div",{className:"flex flex-col items-start gap-3",children:[v(Ax,{}),v("p",{className:"text-muted font-small",children:v(Z,{defaultMessage:"Progress on longer tasks appears here.",id:"cKZ0dC17TM"})})]}));
function Px({todos:e,allTodosCompleted:t,isExpanded:n,setIsExpanded:r,disableTransition:i,headerHostedToggle:a,conversationUuid:o,sessionId:s,isSessionActive:c,disableTodoCommentAttachment:l,revealTodo:u,maxContentHeight:d,shrinkTo:f}){return v(_m,{title:v(Z,{defaultMessage:"Progress",id:"sIMS7iH+wa"}),isExpanded:n,disableTransition:i,onToggle:()=>r(!n),contentClassName:a?void 0:"!pb-2",collapsible:!!o,maxContentHeight:d,shrinkTo:f,headerLeftAction:!a&&!n&&t?v("span",{className:"text-muted font-small",children:v(Z,{defaultMessage:"{count} of {count}",id:"BYBvgncezG",values:{count:e.length}})}):void 0,children:e.length>0?v(ym,{todos:e,live:c,conversationUuid:o,sessionId:s,disableCommentAttachment:l,reveal:u!==void 0&&u.todos===e?u.reveal:void 0}):v(Nx,{})})}
var Fx=E(()=>S("div",{className:"flex flex-col items-start gap-3",children:[v(jx,{}),v("p",{className:"text-muted font-small",children:v(Z,{defaultMessage:"View and open files created during this task.",id:"p41Nenxyun"})})]}));

export { Px, Nx, Ax, kx, Fx, jx, v, _m, Z, ym, E, S, b };
