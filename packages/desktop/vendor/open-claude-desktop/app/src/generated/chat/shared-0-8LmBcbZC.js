// Extracted from Claude Desktop 2.2553.1 shared-0-8LmBcbZC.js. Only asset URLs are made relative. Do not edit.

var xt=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function St(e){return typeof e=="string"&&xt.test(e)}
function xa(e){let t,n=!1;return()=>(n||=(t=e(),!0),t)}
function Ku(e){let t=e.charAt(0).toUpperCase()+e.slice(1),n=e.length<=3?1:3;return e.length<=n?t:t.slice(0,n)+"*".repeat(e.length-n)}
function qu(e){let t=/-1m\b|\[1m\]/i,n=t.test(e)?"1M":void 0,r=e.replace(t,""),i=r.match(/^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?![\d.])(-fast)?(?:-(\d{8}|latest))?/);if(i){let[,e,t,r,a,o]=i;return{base:`${e.charAt(0).toUpperCase()+e.slice(1)} ${r&&r!=="0"?`${t}.${r}`:t}`,suffix:a?"Fast":void 0,ctx:n,internal:!1,family:e,major:Number(t),minor:r===void 0?null:Number(r),snapshot:o}}let a=r.match(/^claude-(\d{1,2})(?:-(\d{1,2}))?-(opus|sonnet|haiku)(?:-(\d{8}|latest))?$/);if(a){let[,e,t,r,i]=a,o=r.charAt(0).toUpperCase()+r.slice(1);return{base:`${t&&t!=="0"?`${e}.${t}`:e} ${o}`,suffix:void 0,ctx:n,internal:!1,family:r,major:Number(e),minor:t===void 0?null:Number(t),snapshot:i}}let o=r.match(/^(?:claude-)?(honly-)?([a-z]+)-v(\d+)(?:-(\d{1,2})\b)?((?:-[a-z][a-z0-9]*)*)/);if(o){let[,e,t,r,i,a]=o,s=[],c=[];for(let t of(e?`-honly${a}`:a).split("-"))!t||t==="prod"||(/^r\d+$/.test(t)?c.push(t):s.push(t.charAt(0).toUpperCase()+t.slice(1)));return{base:`${Ku(t)} ${i&&i!=="0"?`${r}.${i}`:r}`,suffix:[...s,...c].join(" ")||void 0,ctx:n,internal:!0}}return null}
var If=function(e){return e.PerTaskLimit="per_task_limit",e.GlobalLimit="global_limit",e.SignInRequired="sign_in_required",e}({});
var qE="https://support.claude.com/en/articles/13364135-use-claude-cowork-safely";

export { xa, qE, qu, Ku, St, xt, If };
