// Extracted from Claude Desktop 2.2553.1 ca324bb72-DogKBzRY.js. Only asset URLs are made relative. Do not edit.
import { memo as t } from "react";
import { useArtifactIntl as W } from "../../source-artifact-adapters.jsx";
import { jsx as l } from "react/jsx-runtime";
import { messageDescriptors as H } from "../../source-artifact-adapters.jsx";
import { wc as _ } from "./shared-frame-C_2npUJq.js";
import { HostTooltip as P } from "../../source-chat-adapters.jsx";
import { HostButton as g } from "../../source-chat-adapters.jsx";
import { classNames as u } from "../../source-chat-adapters.jsx";
import { nv as ve } from "./shared-14-BOJVa-jT.js";
import { rv as K } from "./shared-14-BOJVa-jT.js";
import { iv as ye } from "./shared-14-BOJVa-jT.js";
import { SourceIcon as ie } from "../../source-chat-adapters.jsx";
var Q="min-w-[3ch] truncate text-footnote font-normal text-gray-900/80 dark:text-gray-0/70";
var at="animate-placeholder-reveal h-[10px] w-24 shrink-0 rounded-sm";
var ot=H({pending:{defaultMessage:"Loading artifact\u2026",id:"amCMfntTXA"}});
function st({title:e,pending:t}){return t?l(_,{as:"span",decorative:!0,className:at}):l("span",{title:e,className:Q,children:e})}
function ct({name:e}){return l(ie,{name:e,size:"sm",className:"shrink-0"})}
function lt({label:e,className:t,children:n}){return l(P,{content:e,side:"bottom",hoverable:!1,className:t,children:n})}
var yt=t(function({title:e,titlePending:t,heading:n}){let r=W(),i=n?"h2":"span";return t?l(i,{"aria-label":r.formatMessage(ot.pending),children:l(st,{title:e,pending:!0})}):l(i,{className:Q,title:e,"data-testid":"frame-artifact-title",children:e})});
function It({glyph:e,label:t,...n}){return l(lt,{label:t,children:l(g,{...n,variant:"ghost",size:"xs",className:u(ve,K,ye),"aria-label":t,children:l(ct,{name:e})})})}

export { yt, ot, st, at, Q, It, lt, ct, t, W, l, H, _, P, g, u, ve, K, ye, ie };
