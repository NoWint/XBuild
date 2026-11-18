// Extracted from Claude Desktop 2.2553.1 shared-16-Cg1UfeMy.js. Only asset URLs are made relative. Do not edit.

function Qm(e,t){if(!t)return!1;let n=t.sessions[e.sessionId],r=e.lastActivityAt??e.createdAt??0;return n===void 0?r>t.initializedAt:r>n}
function $m(e){return!e.isRunning&&e.lastActivityAt!==void 0}

export { Qm, $m };
