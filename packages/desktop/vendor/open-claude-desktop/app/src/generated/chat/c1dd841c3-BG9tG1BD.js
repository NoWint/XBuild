// Extracted from Claude Desktop 2.2553.1 c1dd841c3-BG9tG1BD.js. Only asset URLs are made relative. Do not edit.
import { e as i } from "./c3d5d2a6f-Cb6r-Pna.js";
import { jsxs as t } from "react/jsx-runtime";
import { jsx as e } from "react/jsx-runtime";
import { RoutineMessage as r } from "../../source-routine-detail-adapters.jsx";
import { messageDescriptors as n } from "../../source-artifact-adapters.jsx";
var a=n({manual:{defaultMessage:"Manual",id:"u4f7h0ylkl"},api:{defaultMessage:"API",id:"xwEc8KM8zK"},webhook:{defaultMessage:"GitHub",id:"wO9wb5D8Fn"}});
function o({origin:n}){let o=i(n);return!o||o==="scheduled"?null:t("span",{className:"text-muted",children:[" \u00B7 ",e(r,{...a[o]})]})}

export { o, a, i, t, e, r, n };
