// Extracted from Claude Desktop 2.2553.1 c07677de0-ZWS1w1fw.js. Only asset URLs are made relative. Do not edit.
import { Nb as r } from "./shared-9-Zi4BzzJw.js";
import { en as o } from "./vendor-intl-Cf4IuK3L.js";
var m=o({requiresThisComputer:{defaultMessage:"Requires this computer ({name})",id:"5R1wY7MVLq"},requiresNamed:{defaultMessage:"Requires {name}",id:"dBHfQh4v9t"},requiresYourComputer:{defaultMessage:"Requires your computer",id:"r5hmWCg5bA"},requiresDeregistered:{defaultMessage:"Requires a computer (unknown)",id:"RA10Vf7gGU"},waitingForThisComputer:{defaultMessage:"Waiting for this computer ({name})",id:"m8srUJmz8B"},waitingForNamed:{defaultMessage:"Waiting for {name}",id:"PivaIS6oq/"},waitingForYourComputer:{defaultMessage:"Waiting for your computer",id:"dPECQySsX7"},viewDevices:{defaultMessage:"View your devices",id:"hcHHP+Auij"},deviceConnected:{defaultMessage:"Connected",id:"REG4JFqU41"},deviceNotConnected:{defaultMessage:"Not connected",id:"Im5AhwhiV1"},labelWithConnectivity:{defaultMessage:"{label} \u00B7 {status}",id:"SCg7lgpxxo"}});
function y(e){return e.kind==="held"?"your_computer":"deregistered"}
function b({deviceName:e,here:t,unnamed:n},i){let a=r(e);return a===void 0?i?{message:m.waitingForYourComputer}:{message:e===void 0&&n==="deregistered"&&!t?m.requiresDeregistered:m.requiresYourComputer}:{message:i?t?m.waitingForThisComputer:m.waitingForNamed:t?m.requiresThisComputer:m.requiresNamed,name:a}}
function x(e,t){return t.name===void 0?e.formatMessage(t.message):e.formatMessage(t.message,{name:t.name})}
function w(e,t,n){return x(e,b({deviceName:t,here:n,unnamed:"your_computer"},!0))}

export { y, w, x, b, m, r, o };
