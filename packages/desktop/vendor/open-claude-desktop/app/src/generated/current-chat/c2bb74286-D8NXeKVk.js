// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { D as f } from "./vendor-frame-foKw4lFA.js";
import { useArtifactIntl as R } from "../../source-artifact-adapters.jsx";
import { b as H } from "./c028ce168-BgWF3hW2.js";
import { K as o } from "./vendor-frame-foKw4lFA.js";
import { wS as _e } from "./shared-frame-DVFSKIcx.js";
import { yu as E } from "./shared-frame-DVFSKIcx.js";
import { HostTooltip as j } from "../../source-chat-adapters.jsx";
import { O as Le } from "./c028ce168-BgWF3hW2.js";
var mt="min-w-[3ch] truncate text-footnote font-normal text-gray-900/80 dark:text-gray-0/70";
var ht="min-w-[3ch] truncate text-gray-900/80 dark:text-gray-0/70";
var gt="animate-placeholder-reveal h-[10px] w-24 shrink-0 rounded-sm";
var _t=_e({pending:{defaultMessage:"Loading artifact\u2026",id:"amCMfntTXA"}});
function vt({title:e,pending:t,size:n="xs"}){return t?o(E,{as:"span",decorative:!0,className:gt}):o("span",{title:e,className:n==="base"?ht:mt,children:e})}
function $r({label:e,shortcut:t,detail:n,open:r,children:i}){return o(j,{content:e,shortcut:t,detail:n,open:r,side:"bottom",hoverable:!1,children:i})}
function li(e,t){return t?void 0:mt}
var ui=f(function({title:e,titlePending:t,heading:n}){let r=R(),i=H(),a=n?"h2":"span";return t?o(a,{className:li(i,!0),"aria-label":r.formatMessage(_t.pending),children:o(vt,{title:e,pending:!0})}):o(a,{className:li(i,!1),title:e,"data-testid":"frame-artifact-title",children:e})});
function mi({glyph:e,label:t,detail:n,menuOpen:r=!1,...i}){return o($r,{label:t,detail:n,open:!r&&void 0,children:o(Le,{...i,glyph:e,"aria-label":t})})}

export { ui, li, mt, _t, vt, gt, ht, mi, $r, f, R, H, o, _e, E, j, Le };
