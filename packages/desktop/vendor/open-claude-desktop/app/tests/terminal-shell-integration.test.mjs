import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{prepareTerminalShell,cleanupTerminalShell}=require('../electron/terminal-shell-integration.cjs'),{createTerminalService}=require('../electron/terminal-service.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'openclaude-shell-'));test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
const pause=()=>new Promise(r=>setTimeout(r,25));async function until(fn,label){for(let i=0;i<400;i++){if(fn())return;await pause();}throw Error('Timed out: '+label);}
const hash=s=>createHash('sha256').update(s).digest('hex');
test('original shell scripts and planner match recorded extraction bytes',()=>{
 const dir=path.resolve(import.meta.dirname,'../electron/generated'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'terminal-shell-manifest.json')));
 assert.equal(hash(fs.readFileSync(path.join(dir,manifest.output))),manifest.sha256);assert.equal(hash(fs.readFileSync(path.resolve(dir,'../..',manifest.source))),manifest.sourceSha256);
});
test('planner preserves custom ZDOTDIR and creates private, disposable nonce files outside ASAR',()=>{
 const env={HOME:root,ZDOTDIR:path.join(root,'user rc')},directory=path.join(root,'generated');
 const launch=prepareTerminalShell({shell:'/bin/zsh',args:['-l'],env,directory});assert.equal(launch.kind,'zsh');assert.deepEqual(launch.args,['-l']);
 assert.equal(launch.env.CLAUDE_DESKTOP_USER_ZDOTDIR,env.ZDOTDIR);assert.equal(env.ZDOTDIR,path.join(root,'user rc'));
 assert.match(fs.readFileSync(launch.nonceFile,'utf8'),/^[0-9a-f]{32}\n[0-9a-f]{16}\n$/);assert.equal(fs.statSync(launch.nonceFile).mode&0o777,0o600);
 cleanupTerminalShell(launch);assert.equal(fs.existsSync(launch.nonceFile),false);cleanupTerminalShell(launch);
 for(const [shell,args] of [['/bin/sh',['-l']],['/bin/zsh',['-lc','echo ok']]])assert.equal(prepareTerminalShell({shell,args,env,directory}),null);
});
for(const shell of ['zsh','bash'])for(const backend of ['pty','script'])test(`${shell}/${backend}: user startup preserved, commands automatically emit OSC markers and status`,{timeout:30000},async()=>{
 const home=fs.mkdtempSync(path.join(root,`${shell}-${backend}-`)),rc=path.join(home,'custom rc'),trace=path.join(home,'startup-trace');fs.mkdirSync(rc);
 const files={};const save=(name,text)=>{const file=path.join(shell==='zsh'?rc:home,name);files[file]=text;fs.writeFileSync(file,text);};
 if(shell==='zsh'){
  for(const name of ['.zshenv','.zprofile','.zshrc','.zlogin'])save(name,`print -r -- '${name}' >> '${trace}'\n`+(name==='.zshrc'?"export FIXTURE_STARTUP=zsh-config\nPS1='fixture$ '\nfixture_precmd() { print -r -- 'USER_PROMPT_HOOK'; }\nprecmd_functions+=(fixture_precmd)\n":''));
 }else{
  save('.bash_profile',`printf '.bash_profile\\n' >> '${trace}'\n. "$HOME/.bashrc"\n`);
  save('.bashrc',`printf '.bashrc\\n' >> '${trace}'\nexport FIXTURE_STARTUP=bash-config\nPS1='fixture$ '\nPROMPT_COMMAND='printf "USER_PROMPT_HOOK\\n"'\ntrap 'FIXTURE_DEBUG=preserved' DEBUG\n`);
 }
 const events=[],sender={send:(_channel,event)=>events.push(event),isDestroyed:()=>false,once(){}};
 const service=createTerminalService({resolveOwner:()=>home,shell:`/bin/${shell}`,shellProxy:null,forceScript:backend==='script',baseEnv:{PATH:'/usr/bin:/bin',HOME:home,...(shell==='zsh'?{ZDOTDIR:rc}:{})},shellIntegrationDir:path.join(home,'integration')});
 const output=()=>events.filter(e=>e.kind==='data').map(e=>e.data).join('');
 try{
  const info=await service.call('create',{sessionId:'fixture'},sender);assert.equal(info.shellIntegration,shell);assert.equal(info.backend,backend);
  await until(()=>/\x1b\]133;B;/.test(output()),'first prompt');assert.ok(output().includes('USER_PROMPT_HOOK'));
  const expected=shell==='zsh'?['.zshenv','.zprofile','.zshrc','.zlogin']:['.bash_profile','.bashrc'];assert.deepEqual(fs.readFileSync(trace,'utf8').trim().split('\n'),expected);
  let start=output().length;service.input(sender,info.id,'false\r');await until(()=>/\x1b\]133;D;1;/.test(output().slice(start)),'failure status');assert.match(output().slice(start),/\x1b\]133;C;/);
  start=output().length;service.input(sender,info.id,'true\r');await until(()=>/\x1b\]133;D;0;/.test(output().slice(start)),'success status');
  start=output().length;service.input(sender,info.id,'printf "CONFIG=%s\\n" "$FIXTURE_STARTUP"\r');await until(()=>output().slice(start).includes(`CONFIG=${shell}-config`),'startup variable retained');
  if(shell==='bash'){start=output().length;service.input(sender,info.id,'printf "DEBUG=%s\\n" "$FIXTURE_DEBUG"\r');await until(()=>output().slice(start).includes('DEBUG=preserved'),'existing DEBUG trap retained');}
  for(const [file,bytes]of Object.entries(files))assert.equal(fs.readFileSync(file,'utf8'),bytes,'user rc untouched');
  const integrationRoot=path.join(home,'integration',fs.readdirSync(path.join(home,'integration'))[0],'spawn');await until(()=>fs.readdirSync(integrationRoot).length===0,'nonce file consumed');
  service.input(sender,info.id,'exit\r');await until(()=>events.some(e=>e.kind==='state'&&e.info.status==='exited'),'shell exit');
 }finally{await service.dispose();}
});
