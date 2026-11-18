import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import postcss from 'postcss';
const root=path.resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await fs.readFile(path.join(root,'src/generated/current-chat/provenance.json'),'utf8'));
const source=path.resolve(root,'..',manifest.reference);
const sha=x=>createHash('sha256').update(x).digest('hex');
for(const m of manifest.modules){
 if(sha(await fs.readFile(path.join(source,m.source)))!==m.sha256 || sha(await fs.readFile(path.join(root,'src/generated/current-chat',m.source)))!==m.outputSha256)throw Error(`Current Chat source mismatch: ${m.source}`);
}
const name='c6a992d55-C0zTICcS.css',raw=await fs.readFile(path.join(source,name),'utf8'),tree=postcss.parse(raw);
// Scope installed utilities to Chat/Cowork and explicitly versioned portals.
// Existing Code and unversioned portals keep their own source styles.
// Fonts already use the same families in the host; retain scoped layout/utility rules and animations.
tree.walkAtRules('font-face',r=>r.remove());
// @scope cannot resolve ancestors above its root. Keep the installed html
// headroom predicates outside the scope, and restrict their targets to the same
// Chat/Cowork surface without adding specificity. Preserve media/layer ancestry.
const headroom = postcss.root();
const headroomSelectors = [];
tree.walkRules(rule => {
 const match = /^(html(?:\[data-prerender-headroom-arm=tall\]|:not\(\[data-prerender-headroom-arm\]\))) (.+)$/.exec(rule.selector);
 if (!match) return;
 headroomSelectors.push(rule.selector);
 let branch = rule.clone({selector: `${match[1]} :where(.source-chat-tile-content:not([data-surface="code"])) ${match[2]}`});
 for (let parent = rule.parent; parent.type !== 'root'; parent = parent.parent) {
  const wrapper = parent.clone({nodes: []}); wrapper.append(branch); branch = wrapper;
 }
 headroom.append(branch);
 rule.remove();
});
if (headroomSelectors.length !== 2) throw Error('Installed home headroom rules changed; review the CSS scope adapter');
const dest=path.join(root,'public/assets/current-chat');await fs.mkdir(dest,{recursive:true});
const css=(`@scope (.source-chat-tile-content:not([data-surface="code"]), [data-chat-source-version="2.31226.0"]) {\n${tree}\n}\n${headroom}\n`).replaceAll('/assets/v1/','../v1/');
await fs.writeFile(path.join(dest,'layout.css'),css);
await fs.writeFile(path.join(dest,'provenance.json'),JSON.stringify({version:manifest.version,source:manifest.reference+'/'+name,sha256:sha(raw),outputSha256:sha(css),transform:'Original rules inside Chat/Cowork CSS scope; preserve html headroom predicates outside scope with surface-restricted targets; omit globally provided font faces; relative asset URLs',headroomSelectors},null,2));
// Copy only resources referenced by the extracted declarations, with source hashes.
const resources = new Set();
for (const module of manifest.modules) {
 const code = await fs.readFile(path.join(root,'src/generated/current-chat',module.source),'utf8');
 for (const match of code.matchAll(/"\.\/(assets\/v1\/[^"\s]+|images\/illustrations\/[^"\s]+)"/g)) resources.add(match[1]);
}
const assets = [];
for (const relative of resources) {
 const bytes = await fs.readFile(path.resolve(source,'../..',relative));
 const target = path.join(root,'public',relative);
 await fs.mkdir(path.dirname(target),{recursive:true});
 await fs.writeFile(target,bytes);
 assets.push({path:relative,sha256:sha(bytes)});
}
await fs.writeFile(path.join(dest,'assets.json'),JSON.stringify(assets,null,2)+'\n');
