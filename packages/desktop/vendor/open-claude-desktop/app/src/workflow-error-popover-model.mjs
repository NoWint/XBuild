import { positionMenu, SAFE_POLYGON_LINGER } from './menu-model.mjs';
export const WORKFLOW_PREVIEW_OPEN_MS=600, WORKFLOW_PREVIEW_CLOSE_MS=300;
export function workflowErrorPosition({anchor,width,height,viewport}) {
  return positionMenu({anchor,size:{width,height},viewport,side:'top',align:'end',sideOffset:6,collisionPadding:{top:48,right:8,bottom:8,left:8}});
}
// The dpe call uses PreviewCard's default noninteractive branch. Hover and
// focus are separate reasons; keyboard focus must survive pointer leave.
export function createWorkflowPreview({onChange,onShow=()=>{},schedule=setTimeout,cancel=clearTimeout}) {
  let open=false,hover=false,focused=false,opening=null,closing=null,crossing=null;
  const clear=()=>{cancel(opening);cancel(closing);cancel(crossing);opening=closing=crossing=null;};
  const paint=value=>{if(value===open)return;open=value;if(value)onShow();onChange(value);};
  const hide=()=>{clear();hover=focused=false;paint(false);};
  const closeLater=()=>{if(focused||closing!==null)return;closing=schedule(()=>{closing=null;if(!hover&&!focused)paint(false);},WORKFLOW_PREVIEW_CLOSE_MS);};
  return {
    enter(immediate=false){hover=true;cancel(closing);cancel(crossing);closing=crossing=null;if(open)return;cancel(opening);opening=null;if(immediate){paint(true);return;}opening=schedule(()=>{opening=null;if(hover)paint(true);},WORKFLOW_PREVIEW_OPEN_MS);},
    leave(){hover=false;cancel(opening);cancel(crossing);opening=crossing=null;closeLater();},
    corridor(inside){cancel(crossing);crossing=null;if(inside){cancel(closing);closing=null;crossing=schedule(()=>{crossing=null;closeLater();},SAFE_POLYGON_LINGER);}else closeLater();},
    focus(value){focused=value;if(value){clear();paint(true);}else if(!hover){clear();paint(false);}},
    dismiss:hide,
    dispose(){clear();open=hover=focused=false;},
  };
}
