// Extracted from Claude Desktop 2.2553.1 c1c6ea9ac-D7jZ2mtx.js. Only asset URLs are made relative. Do not edit.
import { useState as n } from "react";
import { useRef as t } from "react";
import { useLayoutEffect as e } from "react";
import { useCallback as r } from "react";
function i(i,a,{frozen:o=!1,axis:s="x"}={}){let[c,l]=n(!1),u=t(i);e(()=>{u.current=i},[i]);let d=r(()=>{let e=u.current;l(e!==null&&(s==="y"?e.scrollHeight>e.clientHeight:e.scrollWidth>e.clientWidth))},[s]);return e(()=>{if(o)return;if(!i){d();return}let e=new ResizeObserver(d);e.observe(i),d();let t=!0;return document.fonts?.ready.then(()=>{t&&d()}),()=>{t=!1,e.disconnect()}},[i,o,d]),e(()=>{o||d()},[o,d,a]),c}

export { i, n, t, e, r };
