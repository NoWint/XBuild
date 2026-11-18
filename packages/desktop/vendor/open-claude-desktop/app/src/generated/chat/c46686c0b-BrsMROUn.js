// Extracted from Claude Desktop 2.2553.1 c46686c0b-BrsMROUn.js. Only asset URLs are made relative. Do not edit.

function t(e){return e.length===0||e.length>1024?"length":/[\p{Cc}\p{Cf}\p{Cs}\u2028\u2029]/u.test(e)?"control_or_format_character":/["<>]/.test(e)?"quote_or_angle_bracket":e.endsWith("\\")?"trailing_backslash":e.toLowerCase().includes("system-reminder")?"reminder_tag_literal":null}
function n(e){return typeof e=="string"&&e.trim().length>0&&!/^(?:[\\/]{2}|[\\/]\?\?[\\/])/.test(e.trim())&&t(e)===null}

export { n, t };
