// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { messageDescriptors as Yc } from "../../source-artifact-adapters.jsx";
function jA(e){return e==="owner"||e==="org"||e==="users"||e==="public"?e:void 0}
var MA=Yc({owner:{defaultMessage:"Private",id:"viXE3205/2"},org:{defaultMessage:"Shared with your organization",id:"r2rZ2u6jxu"},users:{defaultMessage:"Shared with specific people",id:"TfsFMncVHy"},public:{defaultMessage:"Public",id:"uhu5aGgCHC"}});
var PA={owner:"Lock",org:"Organization",users:"Users",public:"Globe"};
function FA(e,t){return e.formatMessage(MA[t])}
function LA(e){return PA[e]}
function KA(e){let t=e.replace(/[\t\n\r]/g,"");if(t[0]==="/"&&t[1]!=="/"&&t[1]!=="\\")return e;let n;try{n=new URL(e,window.location.origin)}catch{return"#"}return n.protocol!=="https:"&&n.protocol!=="http:"?"#":n.origin===window.location.origin||/^https?:\/\//i.test(e.trim())?e:"#"}
function ZA(e){return Number.isFinite(e)?e:void 0}
function QA(e){return[e.updatedAtMs,e.createdAtMs].find(e=>e!==void 0&&Number.isFinite(e))}
function ej(e,t){return e.title||t.formatMessage({defaultMessage:"Untitled artifact",id:"7tJmPLpUEM"})}

export { ZA, QA, KA, ej, jA, FA, MA, LA, PA, Yc };
