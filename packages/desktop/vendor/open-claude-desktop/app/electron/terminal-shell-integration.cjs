'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {shellScripts,shellLaunch,shellKind}=require('./generated/terminal-shell.cjs');
const scripts=shellScripts();
const version=crypto.createHash('sha256').update(JSON.stringify(scripts)).digest('hex').slice(0,16);
// Copy original scripts outside ASAR, into the app's private data directory.
// The source launch planner preserves each shell's startup order; no user rc is edited.
function prepareTerminalShell({shell,args,env,directory}) {
 if(!directory||!shellKind(shell)||args.length!==1||args[0]!=='-l')return null;
 const root=path.join(directory,version),spawnDir=path.join(root,'spawn');let nonceFile;
 try {
  fs.mkdirSync(spawnDir,{recursive:true,mode:0o700});
  for(const [name,body] of Object.entries(scripts)){
   const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
   if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==body)fs.writeFileSync(file,body,{mode:0o600});
  }
  // A crashed/unstarted shell may leave a nonce; expire only our named files.
  for(const name of fs.readdirSync(spawnDir))if(/^[0-9a-f]{32}$/.test(name)){
   const file=path.join(spawnDir,name),stat=fs.lstatSync(file);
   if(stat.isFile()&&Date.now()-stat.mtimeMs>86400000)fs.unlinkSync(file);
  }
  nonceFile=path.join(spawnDir,crypto.randomBytes(16).toString('hex'));
  fs.writeFileSync(nonceFile,crypto.randomBytes(16).toString('hex')+'\n'+crypto.randomBytes(8).toString('hex')+'\n',{mode:0o600,flag:'wx'});
  const launch=shellLaunch(shell,args,root,env.ZDOTDIR,nonceFile);
  if(!launch){fs.unlinkSync(nonceFile);return null;}
  return {...launch,env:{...env,...launch.env},nonceFile};
 }catch(error){if(nonceFile)try{fs.unlinkSync(nonceFile)}catch{};throw error;}
}
function cleanupTerminalShell(integration){if(integration?.nonceFile)try{fs.unlinkSync(integration.nonceFile)}catch{}}
module.exports={prepareTerminalShell,cleanupTerminalShell};
