// Extracted from Claude Desktop 2.2553.1 c7e8a83e5-PPYu2Sp3.js. Only asset URLs are made relative. Do not edit.
import { useState as r } from "react";
import { useMemo as n } from "react";
import { useContext as t } from "react";
import { createContext as i } from "react";
import { jsx as a } from "react/jsx-runtime";
var o=i({report:()=>void 0,rowShown:!1,underRow:!1});
function s(){let[e,t]=r(0),i=e>0,a=e>1;return n(()=>({report:t,rowShown:i,underRow:a}),[i,a])}
function c({children:e,value:t}){let n=s();return a(o.Provider,{value:t??n,children:e})}
function d(){return t(o).underRow}

export { s, d, o, c, r, n, t, i, a };
