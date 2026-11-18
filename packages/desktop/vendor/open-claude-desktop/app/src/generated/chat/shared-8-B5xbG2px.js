// Extracted from Claude Desktop 2.2553.1 shared-8-B5xbG2px.js. Only asset URLs are made relative. Do not edit.
import { createContext as y } from "react";
import { X as aa } from "./shared-frame-C_2npUJq.js";
var Hc="[--cmp-type-size:max(var(--cds-font-size-text-entry-floor,0px),var(--cmp-font-size,var(--cds-font-size-prose)))] [--cmp-leading:round(var(--cmp-type-size)*1.4,1px)] [--cmp-row-py:max(0px,(var(--cds-h-control)-var(--cmp-leading))/2)] [--cmp-row-h:calc(var(--cmp-leading)+2*var(--cmp-row-py))]";
var Uc=`${Hc} py-[var(--cmp-row-py)] text-[length:var(--cmp-type-size)] leading-[var(--cmp-leading)] font-normal`;
var Wc="motion-safe:duration-200";
var Gc=`motion-safe:transition-[padding-left,padding-right] ${Wc}`;
var Kc=`transition-opacity duration-200 motion-safe:transition-[opacity,padding-left,padding-right] ${Wc}`;
var qc=`w-full max-h-96 min-h-[var(--cmp-row-h)] overflow-y-auto break-words ${Uc} ${Kc}`;
function Jc(e,t){let n=e!==void 0&&e>1?`calc(${e}lh + 2 * var(--cmp-row-py))`:void 0;if(n!==void 0||t!==void 0)return{...n===void 0?void 0:{minHeight:n},...t===void 0?void 0:{maxHeight:t}}}
var Yc={glyph:"pl-[6px] compact:pl-[6px] comfortable:pl-[8px]",text:"pl-[4px] compact:pl-[4px] comfortable:pl-[6px]"};
function Xc(e){return e==="none"?void 0:Yc[e]}
var Qc=.3;
var $c=y({multiline:!1,startInset:"none",endInset:"none",glideArmed:!0,columnReservesTrailing:!1});
var el=y({hasContent:!1,busy:!1,pinSend:!1,form:"new"});
var tl=y(null);
var rl="pr-[var(--cmp-trail-w,0px)]";
function il({startInset:e,disabled:t,settled:n,className:r}){return aa(qc,Xc(e),!n&&"transition-none motion-safe:transition-none",t&&"cursor-default opacity-60",r)}
var vl=y({docked:!1,setComposerStartInset:void 0});
var Tl="data-cds-dock-group";

export { $c, Xc, Yc, el, Uc, Hc, Gc, Wc, Qc, vl, rl, tl, Tl, il, qc, Kc, Jc, y, aa };
