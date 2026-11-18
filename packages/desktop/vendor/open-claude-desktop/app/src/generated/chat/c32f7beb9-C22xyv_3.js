// Extracted from Claude Desktop 2.2553.1 c32f7beb9-C22xyv_3.js. Only asset URLs are made relative. Do not edit.
import { useRoutineSkills as r } from "../../source-routine-detail-adapters.jsx";
import { jsx as n } from "react/jsx-runtime";
import { Fragment as e } from "react";
import { Fragment as t } from "react";
import { UnavailableRoutineBadge as i } from "../../source-routine-detail-adapters.jsx";
var a=/(^|\s)(\/[\w:.-]+)/g;
function o({prompt:o}){let s=r(),c=o.split(a);return n(e,{children:c.map((e,r)=>{if(r%3!=2)return n(t,{children:e},r);let a=e.slice(1),o=s.get(a);return o?n(i,{id:a,info:o},r):n(t,{children:e},r)})})}

export { o, a, r, n, e, t, i };
