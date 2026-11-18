// Extracted from Claude Desktop 2.2553.1 shared-3-YXRuSVZn.js. Only asset URLs are made relative. Do not edit.
import { xa as w } from "./shared-0-8LmBcbZC.js";
import { J as bn } from "./vendor-intl-Cf4IuK3L.js";
import { jsx as b } from "react/jsx-runtime";
import { Fragment as v } from "react";
import { Wt as yn } from "./vendor-intl-Cf4IuK3L.js";
var cl="secret";
function ll(e){return`${cl}:${e}`}
function vl(e,t){return e.getFullYear()===t.getFullYear()&&e.getMonth()===t.getMonth()&&e.getDate()===t.getDate()}
function xl(e){let t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!t)return null;let n=new Date(Number(t[1]),Number(t[2])-1,Number(t[3]));return Number.isNaN(n.getTime())||n.getMonth()!==Number(t[2])-1?null:n}
function Sl(e){let t=e=>String(e).padStart(2,"0");return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}`}
var Lf="(?:[^\\S\\n]|[\\p{Mn}\\p{Me}\\u034F\\u115F\\u1160\\u17B4\\u17B5\\u180B-\\u180F\\u200C\\u200D\\u2800\\u3164\\uFE00-\\uFE0F\\uFFA0\\uFFFC\\u{1D159}\\u{E0000}-\\u{E01EF}])";
function Kf(e,t=Qf(),n=Jf){return e.replace(t,(e,t,r)=>{let i=t===0||r[t-1]===`
`?n:32,a=0,o="";for(let t of e){if(o.length+t.length>2*i)break;let e=Zf(t);if(a+e>i)break;a+=e,o+=t}return o})}
var Jf=128;
var Yf={"	":8,"\u1680":2,"\u2001":2,"\u2003":2,"\u3000":2,"\u2800":2,\u115F:2,\u1160:2,"\uFFFC":2,"\uD834\uDD59":2,"\u200C":0,"\u200D":0,"\u034F":0,"\u17B4":0,"\u17B5":0};
var Xf=w(()=>/^[\p{Mn}\p{Me}]$/u);
function Zf(e){let t=e.codePointAt(0)??0;return t>=65024&&t<=65039||t>=6155&&t<=6159||t>=917504&&t<=917999||Xf().test(e)?0:Yf[e]??1}
var Qf=w(()=>/[ \t\p{Mn}\p{Me}\u1680\u2800\uFFFC\u200C\u200D\uFE00-\uFE0F\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u{1D159}\u{E0000}-\u{E01EF}]{5,}/gu);
var $f=w(()=>/(?![\t\n\r\u200C\u200D])[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\u034F\u115F\u1160\u3164\uFE00-\uFE0F\uFFA0\u{E0100}-\u{E01EF}]/gu);
var ep=w(()=>RegExp(`${Lf}{5,}`,"gu"));
var np=/[\s\u2800\uFFFC\u{1D159}]+/gu;
var rp=w(()=>/(^|[\s\u2800\uFFFC\u{1D159}])[\p{Mn}\p{Me}\u200C\u200D]+/gu);
function up(e){return Kf(e.replace(/[\n\r\u2028\u2029]/g," "),ep(),32).replace(rp(),"$1").replace(np," ").trim()}
var fp=4e3;
function mp(e){return e.replace($f(),"")}
function hp(e){return vp(e,mp)}
function vp(e,t){return up(t(e.slice(0,fp)).replace(/\p{Cs}/gu,""))}
var x_=new Set;
function w_(e){for(let t of x_)try{t(e)}catch{}}
function E_(e,t,n=!1){let{messages:r}=e,i=r?.[t];if(typeof i=="string")return i.replace(/'\{(.*?)\}'/gi,"{$1}");if(r&&!Object.hasOwn(r,t))return n&&x_.size>0&&e.locale.toLowerCase()!==e.defaultLocale.toLowerCase()&&w_(t)," "}
function D_({id:e,dangerouslyVisiblePublicValues:t}){let n=bn();if(t===void 0){let t=E_(n,ll(e),!0);if(t!==void 0)return b(v,{children:t})}return b(yn,{id:ll(e),defaultMessage:" ",values:t})}
function A_(e,t){let n=e??{},r=ll(t);if(!(r in n))return!1;let i=n[r];return typeof i=="string"?i.trim().length>0:Array.isArray(i)?i.some(e=>e.type!==0||e.value.trim().length>0):i!=null}
function j_({id:e,intl:t,dangerouslyVisiblePublicValues:n}){let r=ll(e);if(n===void 0){let e=E_(t,r);if(e!==void 0)return e}return t.formatMessage({id:r,defaultMessage:" "},n)}

export { hp, vp, up, Kf, Qf, Jf, Zf, Xf, Yf, ep, Lf, rp, np, fp, mp, $f, vl, j_, ll, cl, E_, x_, w_, A_, D_, Sl, xl, w, bn, b, v, yn };
