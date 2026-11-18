import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {parsers} from '../../tools/node_modules/prettier/plugins/babel.mjs';
const root=path.resolve(import.meta.dirname,'..'),source=path.resolve(root,'../reference/current-2.31226.0/desktop/index.chunk-CiiI592G.js');
const text=await fs.readFile(source,'utf8'),ast=parsers.babel.parse(text,{}),wanted=new Set(['Pq','Pjr','Fq','Fjr','Ijr','Ljr','Rjr','zjr','Bjr','Vjr','Hjr','Ujr','Wjr','Gjr','Kjr','qjr','Jjr','Yjr','Xjr','Zjr','Qjr','Iq','Lq','$jr','tMr','Mjr']);
const parts=[];for(const node of ast.program.body){if(wanted.delete(node.id?.name))parts.push(text.slice(node.start,node.end));for(const d of node.declarations??[])if(wanted.delete(d.id.name))parts.push('var '+text.slice(d.start,d.end)+';');}
if(wanted.size)throw Error('Missing source bindings: '+[...wanted]);
const code='// Generated from Claude 2.31226.0 desktop shell integration; do not edit.\n"use strict";\nconst n={default:require("node:path")};\n'+parts.join('\n')+'\nmodule.exports={shellScripts:Qjr,shellLaunch:tMr,shellKind:$jr};\n';
const output=path.join(root,'electron/generated/terminal-shell.cjs');await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,code);
const sha=s=>createHash('sha256').update(s).digest('hex');await fs.writeFile(path.join(root,'electron/generated/terminal-shell-manifest.json'),JSON.stringify({reference:'2.31226.0',source:path.relative(root,source),sourceSha256:sha(text),output:'terminal-shell.cjs',sha256:sha(code)},null,2)+'\n');console.log('Extracted original shell scripts and launch planner.');
