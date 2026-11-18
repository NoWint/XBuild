import React,{useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {slashMenuLayout,slashDescriptionLayout,slashRowVisible,slashFilterFits} from './slash-menu-layout.mjs';
import {slashMenuEntries} from './session-command-model.mjs';
import {skeletonPlan} from './menu-model.mjs';
import './source-slash-menu.css';
import { t } from '../electron/i18n/index.mjs';
function Match({text,query}) {const at=text.toLowerCase().indexOf(query.toLowerCase());return !query||at<0?text:<>{text.slice(0,at)}<b>{text.slice(at,at+query.length)}</b>{text.slice(at+query.length)}</>;}
const contextAttributes=['data-density','data-mode','data-cds-theme','data-platform','data-font','data-page-bg'];
function syncContext(source,target) {
 if(!source||!target)return;
 for(const name of contextAttributes){const value=source.closest(`[${name}]`)?.getAttribute(name);if(value==null)target.removeAttribute(name);else target.setAttribute(name,value);}
 target.style.setProperty('--cds-rem-scale',source.ownerDocument.defaultView.getComputedStyle(source).getPropertyValue('--cds-rem-scale').trim()||'1');
}
export function SourceSlashMenu({commands,selected,onSelect,onHover,onDismiss,id,query,caret,preSession,loading=false,failed=false,editorRef}) {
 const ref=useRef(null),body=useRef(null),tip=useRef(null),mouseSelection=useRef(null),latest=useRef(onDismiss);latest.current=onDismiss;
 const active=commands[selected],entries=commands.map(c=>c.id).join('\0');
 useLayoutEffect(()=>{
  const menu=ref.current,scroller=body.current,description=tip.current;
  if(!menu||!scroller||!caret)return;
  const doc=menu.ownerDocument,view=doc.defaultView,owner=editorRef?.current||doc.documentElement;
  let frame=0,disposed=false;
  const update=()=>{
   if(disposed)return;
   syncContext(owner,menu);syncContext(owner,description);
   const viewport={width:view.innerWidth,height:view.innerHeight};
   menu.style.maxHeight=`${Math.max(0,Math.min(384,caret.top-34))}px`;
   const rect=menu.getBoundingClientRect(),position=slashMenuLayout({caret,width:rect.width,height:rect.height,viewport});
   Object.assign(menu.style,{left:`${position.left}px`,top:`${position.top}px`,visibility:'visible'});
   const row=scroller.querySelector('[data-highlighted]');
   if(!description||!active?.description||!row){if(description)description.style.visibility='hidden';return;}
   const anchor=row.getBoundingClientRect(),clip=scroller.getBoundingClientRect();
   if(!slashRowVisible(anchor,{left:Math.max(0,clip.left),right:Math.min(viewport.width,clip.right),top:Math.max(0,clip.top),bottom:Math.min(viewport.height,clip.bottom)})){description.style.visibility='hidden';return;}
   description.style.maxWidth='';
   const natural=description.getBoundingClientRect(),rem=parseFloat(view.getComputedStyle(doc.documentElement).fontSize)||16;
   const first=slashDescriptionLayout({anchor,width:natural.width,height:natural.height,viewport,rem});
   description.style.maxWidth=`${first.maxWidth}px`;
   const sized=description.getBoundingClientRect();
   // Retain the flip decision across size middleware, then shift using real height.
   const top=Math.max(8,Math.min(first.align==='end'?anchor.bottom-sized.height:anchor.top,viewport.height-sized.height-8));
   Object.assign(description.style,{left:`${first.side==='right'?anchor.right+8:anchor.left-8-sized.width}px`,top:`${top}px`,visibility:'visible'});
   description.dataset.side=first.side;description.dataset.align=first.align;
  };
  const schedule=()=>{if(!frame)frame=view.requestAnimationFrame(()=>{frame=0;update();});};
  update();
  const row=scroller.querySelector('[data-highlighted]');
  if(row&&mouseSelection.current!==selected){const r=row.getBoundingClientRect(),clip=scroller.getBoundingClientRect();if(r.top<clip.top+4)scroller.scrollTop-=clip.top+4-r.top;else if(r.bottom>clip.bottom-4)scroller.scrollTop+=r.bottom-(clip.bottom-4);update();}
  mouseSelection.current=null;
  const outside=event=>{if(!menu.contains(event.target))latest.current?.();};
  const resize=new view.ResizeObserver(schedule);resize.observe(menu);resize.observe(scroller);if(description)resize.observe(description);
  const mutation=new view.MutationObserver(schedule);for(let node=owner;node;node=node.parentElement)mutation.observe(node,{attributes:true});
  doc.addEventListener('mousedown',outside);view.addEventListener('scroll',schedule,true);view.addEventListener('resize',schedule);
  return()=>{disposed=true;if(frame)view.cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();doc.removeEventListener('mousedown',outside);view.removeEventListener('scroll',schedule,true);view.removeEventListener('resize',schedule);};
 },[selected,query,entries,active?.description,caret?.left,caret?.top,preSession,loading,failed,editorRef]);
 if(!caret)return null;
 const doc=editorRef?.current?.ownerDocument||document;
 return createPortal(<>
  <div ref={ref} id={id} role="menu" aria-label={t('Slash commands')} className="source-slash-menu cds-root" data-positioning={editorRef?.current?.getCaretViewportRect?"editor-coordinates":"textarea-mirror"} style={{visibility:'hidden'}} onMouseDown={e=>e.preventDefault()}>
   <div ref={body} className="source-slash-body scroll-fade-y">
    {/* c5cd1b4dc :3586-3700 + ccc334009 z/G: section headers, the skill rows (an overriding row's 'Custom command'
        subtitle sits at the right, ml-auto pl-2 caption muted, read out after the name), and the loading skeleton
        (ccc334009 z: {type:'loading'} without an icon draws one 16px bar, shared-3 br rows 1). */}
    {slashMenuEntries(commands,{preSession,loading,failed}).map((entry,key)=>entry.type==='header'?<div key={`h${key}`} className="slash-header" role="presentation">{t(entry.label)}</div>
     :entry.type==='loading'?<div key="loading" className="smenu-skeleton-row slash-loading" data-slash-loading=""><span className="smenu-skeleton" style={{width:skeletonPlan(1)[0].width,height:16}} role="status"><span className="smenu-sr-only">{t('Loading')}</span></span></div>
     :(({command:c,index:i})=><div key={`${c.kind||'command'}:${c.id}`} id={`${id}-${i}`} role="menuitem" tabIndex={-1} data-highlighted={selected===i?'':undefined} onMouseMove={()=>{if(i!==selected){mouseSelection.current=i;onHover(i);}}} onClick={()=>onSelect(c.id)}><span className="slash-label"><Match text={c.id} query={query}/>{c.matchedAlias&&<span className="slash-alias"> (<Match text={c.matchedAlias} query={query}/>)</span>}</span>{c.subtitle&&<span className="slash-subtitle"><span className="sc-sr-only">, </span>{t(c.subtitle)}</span>}</div>)(entry))}
   </div>
  </div>
  <div ref={tip} className="slash-description cds-root" role="tooltip" style={{visibility:'hidden'}}><div className="slash-description-text"><Match text={active?.description||''} query={query}/></div></div>
 </>,doc.body);
}
export function SlashHint({caret,text,argument=false,id,editorRef,getCaret}) {
 const ref=useRef(null);
 useLayoutEffect(()=>{
  const hint=ref.current,editor=editorRef?.current;if(!hint||!editor)return;
  const doc=editor.ownerDocument,view=doc.defaultView;
  const update=()=>{
   syncContext(editor,hint);
   const position=getCaret(editor,argument?editor.value.length:editor.selectionStart),font=view.getComputedStyle(editor);
   Object.assign(hint.style,{fontFamily:font.fontFamily,fontSize:font.fontSize,lineHeight:font.lineHeight});
   const fits=argument||slashFilterFits({start:editor.selectionStart,end:editor.selectionEnd,length:editor.value.length,caretLeft:position.left,parentRight:editor.parentElement.getBoundingClientRect().right,width:hint.getBoundingClientRect().width});
   Object.assign(hint.style,{left:`${position.left+2}px`,top:`${position.top+position.height/2}px`,visibility:fits?'visible':'hidden'});
  };
  update();const observer=new view.ResizeObserver(update);observer.observe(editor);observer.observe(hint);
  const mutation=new view.MutationObserver(update);for(let node=editor;node;node=node.parentElement)mutation.observe(node,{attributes:true});
  doc.addEventListener('selectionchange',update);view.addEventListener('resize',update);view.addEventListener('scroll',update,true);
  return()=>{observer.disconnect();mutation.disconnect();doc.removeEventListener('selectionchange',update);view.removeEventListener('resize',update);view.removeEventListener('scroll',update,true);};
 },[text,argument,caret?.left,caret?.top,editorRef,getCaret]);
 if(!caret||!text)return null;
 return createPortal(<><span ref={ref} className={argument?'slash-argument cds-root':'slash-filter cds-root'} data-skill-arg-hint={argument||undefined} aria-hidden="true" style={{left:caret.left+2,top:caret.top+caret.height/2}}>{text}</span>{argument&&<span className="sc-sr-only" role="status" aria-live="polite" id={id}>{text}</span>}</>,editorRef?.current?.ownerDocument.body||document.body);
}
