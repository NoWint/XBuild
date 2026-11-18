import React,{useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {createWorkflowPreview,workflowErrorPosition} from './workflow-error-popover-model.mjs';
import {safeHoverHull,insideHoverHull} from './source-tooltip-model.js';
import './source-workflow-error.css';
import {t} from '../electron/i18n/index.mjs';
const currentPreviews=new WeakMap();
export function WorkflowErrorPopover({error}) {
 const [open,setOpen]=useState(false),trigger=useRef(null),popup=useRef(null),corridor=useRef(null),id=useId();
 const [controller]=useState(()=>createWorkflowPreview({onChange:value=>{setOpen(value);if(!value){corridor.current=null;const doc=trigger.current?.ownerDocument;if(doc&&currentPreviews.get(doc)===controller)currentPreviews.delete(doc);}},onShow:()=>{const doc=trigger.current?.ownerDocument;if(!doc)return;const old=currentPreviews.get(doc);if(old!==controller)old?.dismiss();currentPreviews.set(doc,controller);}}));
 useLayoutEffect(()=>{const doc=trigger.current.ownerDocument;return()=>{controller.dispose();if(currentPreviews.get(doc)===controller)currentPreviews.delete(doc);};},[controller]);
 const enter=event=>{if(event.pointerType!=='mouse')return;corridor.current=null;const active=currentPreviews.get(trigger.current.ownerDocument);controller.enter(!!active);};
 const leave=event=>{if(event.pointerType!=='mouse')return;controller.leave();const target=event.currentTarget===trigger.current?popup.current:trigger.current;if(target)corridor.current=safeHoverHull({x:event.clientX,y:event.clientY},target.getBoundingClientRect());};
 const blur=event=>{if(!trigger.current?.contains(event.relatedTarget)&&!popup.current?.contains(event.relatedTarget))controller.focus(false);};
 useLayoutEffect(()=>{
  if(!open)return;const doc=trigger.current.ownerDocument;
  const key=event=>{if(event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopPropagation();controller.dismiss();}};
  const outside=event=>{if(!trigger.current?.contains(event.target)&&!popup.current?.contains(event.target))controller.dismiss();};
  const move=event=>{if(event.pointerType==='mouse'&&corridor.current)controller.corridor(insideHoverHull({x:event.clientX,y:event.clientY},corridor.current));};
  doc.addEventListener('keydown',key,true);doc.addEventListener('pointerdown',outside,true);doc.addEventListener('pointermove',move);
  return()=>{doc.removeEventListener('keydown',key,true);doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('pointermove',move);};
 },[open,controller]);
 return <><span ref={trigger} tabIndex={0} aria-label={error} className="swf-error-trigger" data-popup-open={open||undefined}
 onPointerEnter={enter} onPointerLeave={leave} onFocus={event=>{if(event.target.matches(':focus-visible'))controller.focus(true);}} onBlur={blur}>{t('Error')}</span>
 {open&&<ErrorPreview {...{error,trigger,popup,id}} onPointerEnter={enter} onPointerLeave={leave} onFocus={()=>controller.focus(true)} onBlur={blur} onHidden={()=>controller.dismiss()}/>}</>;
}
function ErrorPreview({error,trigger,popup,id,onHidden,...events}) {
 const [layout,setLayout]=useState({visibility:'hidden'}),[context,setContext]=useState({});const latest=useRef(onHidden);latest.current=onHidden;
 useLayoutEffect(()=>{
  const owner=trigger.current,node=popup.current;if(!owner||!node)return;const view=owner.ownerDocument.defaultView;
  const update=()=>{
   if(!owner.isConnected||!owner.getClientRects().length){latest.current();return;}
   const attrs={};for(const name of ['data-density','data-mode','data-cds-theme','data-platform','data-font','data-page-bg']){const value=owner.closest(`[${name}]`)?.getAttribute(name);if(value!=null)attrs[name]=value;}
   const styles=view.getComputedStyle(owner),scale=styles.getPropertyValue('--cds-rem-scale').trim()||'1',base=Number.parseInt(styles.getPropertyValue('--cds-layer-base'),10)||0;
   setContext(current=>JSON.stringify(current)===JSON.stringify(attrs)?current:attrs);
   const rect=node.getBoundingClientRect(),position=workflowErrorPosition({anchor:owner.getBoundingClientRect(),width:rect.width,height:rect.height,viewport:{width:view.innerWidth,height:view.innerHeight}});
   setLayout({left:position.left,top:position.top,zIndex:base+120,'--cds-layer-base':base+100,'--cds-rem-scale':scale,'--preview-side':position.side});
  };
  update();const resize=new view.ResizeObserver(update);resize.observe(owner);resize.observe(node);
  const observer=new view.MutationObserver(update);for(let ancestor=owner;ancestor;ancestor=ancestor.parentElement)observer.observe(ancestor,{attributes:true});
  view.addEventListener('resize',update);view.addEventListener('scroll',update,true);
  return()=>{resize.disconnect();observer.disconnect();view.removeEventListener('resize',update);view.removeEventListener('scroll',update,true);};
 },[trigger,popup,error]);
 return createPortal(<div {...context} className="cds-root epitaxy-root swf-error-portal" data-cds-portal="" style={{'--cds-rem-scale':layout['--cds-rem-scale']}}>
 <div {...events} ref={popup} id={id} data-cds="PreviewCard" data-open="" data-side={layout['--preview-side']} className="swf-error-popup" style={layout} onContextMenu={event=>event.stopPropagation()}><span className="swf-error-text">{error}</span></div>
 </div>,trigger.current.ownerDocument.body);
}
