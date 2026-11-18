import React,{useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Icon} from './icons.jsx';
import {SourceSettingsButton} from './source-settings-button.jsx';
import {createDismissedTasksStore,createTaskRowsStore,loopDaysLeft,stopsInLabel,monitorTasks,previewServerTasks,scheduledLoops,taskKindLabel,taskOutput,taskSections} from './background-tasks-model.mjs';
import { formatDuration } from './command-row-model.mjs';
import { SourceAnsiText } from './source-ansi-text.jsx';
import { SourceCommandLine } from './source-command.jsx';
import { taskOutputFollow } from './task-output-follow.mjs';
import { getLocale, t } from '../electron/i18n/index.mjs';
import './source-background-tasks.css';
import { localizeBridgeText } from './bridge-text-model.mjs';
// ES/wS/TS: one dismissed-task store for the pane header's Clear button and the list.
export const dismissedTasksStore=createDismissedTasksStore((()=>{try{return globalThis.localStorage;}catch{return null;}})());
// c03935b01 openTaskRowsBySession / stoppingIdsBySession: open rows and pending stops outlive the pane and session switches.
export const taskRowsStore=createTaskRowsStore();
/** rw (cccc2cf0a :12505-12522): the header's ghost Trash button; aria-disabled (opacity) while nothing has finished. */
export function SourceClearFinishedTasks({sessionId,store=dismissedTasksStore}){
 const finished=useSyncExternalStore(store.subscribe,()=>store.finished(sessionId));
 return <button type="button" className="source-icon-button spc-ghost sbt-clear" aria-label={t('Clear finished tasks')} aria-disabled={finished.length===0||undefined}
  onMouseDown={event=>event.preventDefault()} onClick={()=>store.clear(sessionId)}><Icon name="Trash" size={16}/></button>;
}
export function SourceTaskOutput({task,sessionId}) {
  const output=useRef(null), key=JSON.stringify([sessionId,task.id]), text=taskOutput(task.output || '');
  useLayoutEffect(()=>{taskOutputFollow.update(key,output.current);},[key,text]);
  return <div className="sbt-detail">
    {task.command&&<div role="region" tabIndex={0} aria-label={t('Command for {task}',{task:task.description})} className="sbt-command">
      <SourceCommandLine command={task.command} scopeKey={key}/>
    </div>}
    {task.output?<pre ref={output} role="region" tabIndex={0} aria-label={t('Output for {task}',{task:task.description})}
      onScroll={e=>taskOutputFollow.record(key,e.currentTarget)}><SourceAnsiText text={text}/></pre>
      :<span>{task.summary&&task.summary!==task.description?task.summary:task.status==='running'?t('No output yet'):task.status==='unknown'?t('Output unavailable'):t('No output captured.')}</span>}
  </div>;
}
// OC (cccc2cf0a :11432-11446): a running Monitor's countdown to its deadline, hidden in the last second.
function StopsIn({stopsAt}){const [now,setNow]=useState(Date.now);useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);const label=stopsInLabel(stopsAt,now,getLocale());return label?<span className="sbt-time">{label}</span>:null;}
function Elapsed({task}){const [now,setNow]=useState(Date.now);useEffect(()=>{if(task.status!=='running'||!Number.isFinite(task.startedAt))return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[task.status,task.startedAt]);const ms=task.status==='running'&&Number.isFinite(task.startedAt)?Math.max(0,now-task.startedAt):task.durationMs;return Number.isFinite(ms)?<span className="sbt-time">{formatDuration(ms/1000)}</span>:null;}
// Tb: a running preview server's uptime, in the UI language (formatDuration is the transcript timer's wording).
function Uptime({startedAt}){const [now,setNow]=useState(Date.now);useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);return <span className="sbt-time">{formatDuration(Math.max(0,now-startedAt)/1000)}</span>;}
// The session folder's preview servers (preview-service.cjs state), pushed as they change.
// Both feeds are null until their first answer, so a remounted list keeps a pending stop until it knows the state.
function usePreviewServers(sessionId,desktop){const [servers,setServers]=useState(null);useEffect(()=>{if(!sessionId||!desktop?.call){setServers([]);return undefined;}setServers(null);let live=true;desktop.call('preview-state',{sessionId}).then(state=>{if(live)setServers(previewServerTasks(state));},()=>{if(live)setServers(old=>old??[]);});const off=desktop.onEvent?.(event=>{if(event?.kind==='preview'&&event.sessionId===sessionId&&event.state)setServers(previewServerTasks(event.state));});return()=>{live=false;off?.();};},[sessionId,desktop]);return servers;}
// The session's Monitor commands and scheduled prompts (electron/monitor-service.cjs, schedule-service.cjs), pushed as they change.
function useAppFeed(sessionId,desktop,action,kind,key){const [list,setList]=useState(null);useEffect(()=>{if(!sessionId||!desktop?.call){setList([]);return undefined;}setList(null);let live=true;desktop.call(action,{sessionId}).then(value=>{if(live)setList(Array.isArray(value)?value:[]);},()=>{if(live)setList(old=>old??[]);});const off=desktop.onEvent?.(event=>{if(event?.kind===kind&&event.sessionId===sessionId&&Array.isArray(event[key]))setList(event[key]);});return()=>{live=false;off?.();};},[sessionId,desktop,action,kind,key]);return list;}
// 'Next <v>{countdown}</v>' / 'Ends <v>{days}d</v>': the translated sentence with its value in the secondary colour.
function Valued({text,value}){const [before,after='']=text.split('\u0000');return <span>{before}<span className="sbt-value">{value}</span>{after}</span>;}
function Countdown({at}){const [now,setNow]=useState(Date.now);useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);return <span className="sbt-time"><Valued text={t('Next {countdown}',{countdown:'\u0000'})} value={formatDuration(Math.max(0,at-now)/1000)}/></span>;}
// Kb (panes-tile-current.js:15081-15190): "Loop" / "Once", the cadence, Next {countdown} and, for a loop, Ends {days}d.
export function LoopCard({loop,stopping,onStop}){const once=!loop.recurring,title=loop.prompt??(once?t('Scheduled prompt'):t('Recurring loop')),days=once?null:loopDaysLeft(loop);
 return <div className="sbt-card" data-status="running" data-loop={loop.id}><div className="sbt-card-body"><div className="sbt-top">
  <span className="sbt-title" tabIndex={-1} aria-label={once?t('Once: {description}',{description:title}):t('Loop: {description}',{description:title})}><span data-cds="ShimmerText" className="source-shimmer">{title}</span></span>
  {onStop&&<SourceSettingsButton size="sm" variant="secondary" icon="Stop" iconSize="auto" iconOnly className="sbt-stop epitaxy-task-row-secondary" aria-label={stopping?t('Stop requested…'):once?t('Stop this scheduled prompt'):t('Stop this loop')} busy={stopping} disabled={stopping} onClick={onStop}/>}
 </div><div className="sbt-metadata"><div className="sbt-meta">
  <span className="sbt-kind">{once?t('Once'):t('Loop')}</span>
  <span role="status" className="source-sr-only">{stopping?t('Stop requested…'):null}</span>
  {stopping?<span aria-hidden="true">{t('Stop requested…')}</span>:null}
  {(loop.humanSchedule??loop.cron)?<span>{loop.humanSchedule??loop.cron}</span>:null}
 </div><div className="sbt-meta">
  {Number.isFinite(loop.nextFireAt)&&<Countdown at={loop.nextFireAt}/>}
  {days!==null&&<Valued text={t('Ends {days}d',{days:'\u0000'})} value={String(days)}/>}
 </div></div></div></div>;}
// qb (panes-tile-current.js:15192-15265) inside Wb: "Preview" · Starting…/Failed · uptime, then localhost:port.
function PreviewServerCard({server,stopping,onStop}){const failed=server.status==='error';
 return <div className="sbt-card" data-status={failed?'failed':'running'} data-preview-server={server.name}><div className="sbt-card-body"><div className="sbt-top">
  <span className="sbt-title" tabIndex={-1} aria-label={t('Preview server: {name}',{name:server.name})}><span data-cds="ShimmerText" className={failed?'':'source-shimmer'}>{server.name}</span></span>
  {onStop&&<SourceSettingsButton size="sm" variant="secondary" icon="Stop" iconSize="auto" iconOnly className="sbt-stop epitaxy-task-row-secondary" aria-label={stopping?t('Stopping server…'):t('Stop this server')} busy={stopping} disabled={stopping} onClick={onStop}/>}
 </div><div className="sbt-metadata"><div className="sbt-meta">
  <span className="sbt-kind">{t('Preview')}</span>
  <span role="status" className="source-sr-only">{stopping?t('Stopping…'):null}</span>
  {stopping?<span aria-hidden="true">{t('Stopping…')}</span>:server.status==='starting'?<span>{t('Starting…')}</span>:failed?<span className="sbt-failed">{t('Failed')}</span>:null}
  {!failed&&Number.isFinite(server.startedAt)&&<Uptime startedAt={server.startedAt}/>}
 </div>{server.port?<div className="sbt-meta"><span>{`localhost:${server.port}`}</span></div>:null}</div></div></div>;}
export function SourceBackgroundTasks({tasks:coreTasks,sessionId,onOpen,onStop,renderWorkflow,focusTask,onFocusDone,error,finishedExpanded=false,onFinishedExpanded,desktop=globalThis.desktop}){
 // Monitor commands are tasks of their own (Claude's monitor_mcp rows); scheduled prompts are Loop / Once rows.
 const monitorFeed=useAppFeed(sessionId,desktop,'monitor-state','monitors','monitors'),loopFeed=useAppFeed(sessionId,desktop,'schedule-state','schedules','jobs'),loops=scheduledLoops(loopFeed);
 const tasks=React.useMemo(()=>[...coreTasks,...monitorTasks(monitorFeed)],[coreTasks,monitorFeed]);
 const rowsStore=taskRowsStore,openRows=useSyncExternalStore(rowsStore.subscribe,()=>rowsStore.openRows(sessionId)),stopping=useSyncExternalStore(rowsStore.subscribe,()=>rowsStore.stopping(sessionId,'task'));
 const stoppingLoops=useSyncExternalStore(rowsStore.subscribe,()=>rowsStore.stopping(sessionId,'loop')),stoppingServers=useSyncExternalStore(rowsStore.subscribe,()=>rowsStore.stopping(sessionId,'server'));
 useEffect(()=>{if(loopFeed!==null)rowsStore.releaseStopping(sessionId,'loop',[...stoppingLoops].filter(id=>!loops.some(loop=>loop.id===id)));},[loopFeed,stoppingLoops,sessionId]);
 const stopLoop=loop=>{if(!desktop?.call||!rowsStore.markStopping(sessionId,'loop',loop.id))return;root.current?.focus();desktop.call('schedule-stop',{sessionId,id:loop.id}).catch(e=>{rowsStore.releaseStopping(sessionId,'loop',loop.id);if(alive.current)setNotice(localizeBridgeText(e?.message||''));});};
 const serverFeed=usePreviewServers(sessionId,desktop),servers=serverFeed??[];
 // A stop settles when the server leaves the list (stopped) or fails.
 useEffect(()=>{if(serverFeed!==null)rowsStore.releaseStopping(sessionId,'server',[...stoppingServers].filter(id=>!serverFeed.some(server=>server.id===id&&server.status!=='error')));},[serverFeed,stoppingServers,sessionId]);
 const stopServer=server=>{if(!desktop?.call||!rowsStore.markStopping(sessionId,'server',server.id))return;root.current?.focus();desktop.call('preview-server-stop',{sessionId,name:server.name}).catch(e=>{rowsStore.releaseStopping(sessionId,'server',server.id);if(alive.current)setNotice(localizeBridgeText(e?.message||''));});};
 const dismissedIds=useSyncExternalStore(dismissedTasksStore.subscribe,()=>dismissedTasksStore.dismissed(sessionId)),[notice,setNotice]=useState(''),root=useRef(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const runningIds=tasks.filter(t=>t.status==='running').map(t=>t.id),visible=tasks.filter(t=>t.status==='running'||!dismissedIds.includes(t.id)),sections=taskSections(visible);
 // iw: a dismissed task running again comes back.
 useEffect(()=>{dismissedTasksStore.restore(sessionId,runningIds);},[runningIds.join('\0'),sessionId,dismissedIds]);
 // The header's Clear button (SourceClearFinishedTasks) clears what this list shows as finished.
 const finishedIds=sections.finished.map(t=>t.id);
 useLayoutEffect(()=>{dismissedTasksStore.setFinished(sessionId,finishedIds);},[sessionId,finishedIds.join('\0')]);
 // A stop settles once its task is no longer running; a Monitor missing before the feed answers is still unknown.
 useEffect(()=>{if(tasks.some(t=>t.status==='stopped'&&stopping.has(t.id)))setNotice(t('Task stopped'));rowsStore.releaseStopping(sessionId,'task',[...stopping].filter(id=>{const task=tasks.find(t=>t.id===id);return task?task.status!=='running':monitorFeed!==null||!id.startsWith('monitor:');}));},[tasks,stopping,monitorFeed,sessionId]);
 useEffect(()=>{if(!focusTask)return;rowsStore.setRowsOpen(sessionId,[focusTask],true);if(sections.finished.some(t=>t.id===focusTask))onFinishedExpanded(true);const frame=requestAnimationFrame(()=>{root.current?.querySelector(`[data-task-id="${CSS.escape(focusTask)}"]`)?.scrollIntoView({block:'start'});onFocusDone?.();});return()=>cancelAnimationFrame(frame);},[focusTask]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
 async function stop(task){if(!rowsStore.markStopping(sessionId,'task',task.id))return;root.current?.focus();setNotice(t('Stop requested…'));try{if(task.monitorId&&desktop?.call)await desktop.call('monitor-stop',{sessionId,id:task.monitorId});else await onStop(task);}catch(e){rowsStore.releaseStopping(sessionId,'task',task.id);if(alive.current){setNotice(t('Couldn’t stop the task — check your connection and try again.')+' '+localizeBridgeText(e.message));}}}
 const row=task=>task.kind==='workflow'?<React.Fragment key={task.id}>{renderWorkflow(task)}</React.Fragment>:<TaskCard key={task.id} task={task} sessionId={sessionId} expanded={openRows.get(task.id)===true} stopping={stopping.has(task.id)} onStop={()=>stop(task)} onOpen={onOpen} onToggle={()=>rowsStore.setRowsOpen(sessionId,[task.id],openRows.get(task.id)!==true)}/>;
 return <div ref={root} className="sbt-root" tabIndex={-1}><span role="status" className="source-sr-only">{notice}</span>{error&&<p role="alert" className="sbt-error">{error}</p>}{!visible.length&&!servers.length&&!loops.length?<div className="sbt-empty"><Icon name="AgentsSimple" size={28}/><span>{t('Background tasks appear here')}</span></div>:<div className="sbt-content">{(sections.running.length>0||servers.length>0||loops.length>0)&&<section><h3>{t('Running')}</h3><div className="sbt-list">{servers.map(server=><PreviewServerCard key={server.id} server={server} stopping={stoppingServers.has(server.id)} onStop={desktop?.call?()=>stopServer(server):undefined}/>)}{loops.map(loop=><LoopCard key={'loop:'+loop.id} loop={loop} stopping={stoppingLoops.has(loop.id)} onStop={desktop?.call?()=>stopLoop(loop):undefined}/>)}{sections.running.map(row)}</div></section>}{sections.unknown.length>0&&<section><h3>{t('Status unavailable')}</h3><div className="sbt-list">{sections.unknown.map(row)}</div></section>}{sections.finished.length>0&&<section><div className="sbt-section-heading"><h3><button aria-expanded={finishedExpanded} onClick={()=>onFinishedExpanded(!finishedExpanded)}>{t('Finished')} <span>{sections.finished.length}</span><Icon name="CaretRight" size={12} className={finishedExpanded?'sbt-finished-caret sbt-open':'sbt-finished-caret'}/></button></h3></div>{finishedExpanded&&<div className="sbt-list">{sections.finished.map(row)}</div>}</section>}</div>}</div>;
}

// Ub: metadata is one padded column; only expandable cards own hover paint.
function TaskCard({task,sessionId,expanded,stopping,onStop,onOpen,onToggle}) {
 const running=task.status==='running',expandable=task.kind==='bash';
 const hasDetails=(running&&task.stoppable===false)||!!task.model||Number.isFinite(task.tokens)||Number.isFinite(task.toolUses)||(running&&!!task.lastTool)||task.kind==='agent';
 const title=<><span data-cds="ShimmerText" className={running?'source-shimmer':''}>{task.description}</span>{expandable&&<span className="sbt-caret-slot"><Icon name="CaretRight" size={12} style={{fontSize:'calc(.75rem * var(--cds-rem-scale, 1))'}} className={expanded?'sbt-caret sbt-open':'sbt-caret'}/></span>}</>;
 return <div data-task-id={task.id} className="sbt-card" data-status={task.status} data-expandable={expandable||undefined}>
  <div className="sbt-card-body"><div className="sbt-top">
   {expandable?<button className="sbt-title" aria-label={t('Background task: {task}',{task:task.description})} aria-expanded={expanded} onClick={onToggle}>{title}</button>:<span className="sbt-title">{title}</span>}
   {running&&task.stoppable!==false&&(task.kind==='bash'||task.turnId)&&<SourceSettingsButton size="sm" variant="secondary" icon="Stop" iconSize="auto" iconOnly className="sbt-stop epitaxy-task-row-secondary" aria-label={t('Stop this task')} busy={stopping} disabled={stopping} onClick={onStop}/>}
  </div><div className="sbt-metadata"><div className="sbt-meta">
   <span className="sbt-kind">{taskKindLabel(task)}</span>
   {running?stopping?<span>{t('Stopping…')}</span>:null:<span className={task.status==='failed'?'sbt-failed':''}>{({completed:t('Completed'),failed:t('Failed'),stopped:t('Stopped'),unknown:t('Status unavailable')})[task.status]}</span>}
   <Elapsed task={task}/>
   {running&&Number.isFinite(task.stopsAt)&&<StopsIn stopsAt={task.stopsAt}/>}
  </div>{hasDetails&&<div className="sbt-meta">
   {task.model&&<span className="sbt-value">{task.model}</span>}
   {Number.isFinite(task.tokens)&&<span><span className="sbt-value">{task.tokens.toLocaleString()}</span> {t('tokens')}</span>}
   {Number.isFinite(task.toolUses)&&<span><span className="sbt-value">{task.toolUses}</span> {task.toolUses===1?t('tool use'):t('tool uses')}</span>}
   {running&&task.lastTool&&<span>{task.lastTool}</span>}
   {running&&task.stoppable===false&&<span className="sbt-hint">{t('Ask DeepSeek to stop this task, or end the session.')}</span>}
   {task.kind==='agent'&&<button className="sbt-link epitaxy-task-row-secondary" aria-label={t('View transcript for {task}',{task:task.description})} onClick={event=>onOpen(task.sourceItem||{},task.threadId,event.currentTarget)}>{t('View transcript')}</button>}
  </div>}</div></div>
  {expanded&&expandable&&<SourceTaskOutput task={task} sessionId={sessionId}/>}
 </div>;
}
