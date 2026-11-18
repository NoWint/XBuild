const clamp=(value,low,high)=>Math.min(Math.max(value,low),Math.max(low,high));
// BT floating branch: top-start, no flip, offset(10,-16), shift padding8,
// size(availableHeight-16), cap384. Width comes from the actual rendered menu.
export function slashMenuLayout({caret,width,height,viewport}) {
 const maxHeight=Math.max(0,Math.min(384,caret.top-34));
 return {left:clamp(caret.left-16,8,viewport.width-width-8),top:caret.top-10-Math.min(height,maxHeight),maxHeight};
}
// c17e03edc x: right-start with8px gap; flip to the better fitting side,
// shift along the vertical axis and size to available side width (10–26rem cap).
export function slashDescriptionLayout({anchor,width,height,viewport,rem=16}) {
 const room={right:viewport.width-anchor.right-16,left:anchor.left-16};
 // The default flip strategy tries the opposite alignment before the opposite
 // side. Keep signed overflow: fitting candidates must not be ranked as equal
 // to candidates whose bottom is actually outside the viewport.
 const choices=['right','left'].flatMap(side=>['start','end'].map(align=>{
  const top=align==='start'?anchor.top:anchor.bottom-height;
  const edges={top:8-top,bottom:top+height-(viewport.height-8)};
  const leading=(align==='start')===(anchor.bottom-anchor.top<=height)?'bottom':'top';
  const overflow=[width-room[side],edges[leading],edges[leading==='top'?'bottom':'top']];
  return {side,align,top,overflow};
 }));
 let choice=choices.find(value=>value.overflow.every(amount=>amount<=0));
 if(!choice){
  const fitsSide=choices.filter(value=>value.overflow[0]<=0);
  choice=fitsSide.length?fitsSide.sort((a,b)=>a.overflow[1]-b.overflow[1])[0]:
   choices.sort((a,b)=>a.overflow.reduce((sum,n)=>sum+Math.max(0,n),0)-b.overflow.reduce((sum,n)=>sum+Math.max(0,n),0))[0];
 }
 const {side,align}=choice,maxWidth=Math.min(26*rem,Math.max(10*rem,Math.floor(room[side])));
 return {side,align,maxWidth,left:side==='right'?anchor.right+8:anchor.left-8-Math.min(width,maxWidth),top:clamp(choice.top,8,viewport.height-height-8)};
}
export function slashRowVisible(row,clip) {
 return row.bottom>clip.top&&row.top<clip.bottom&&row.right>clip.left&&row.left<clip.right;
}
export function slashFilterFits({start,end,length,caretLeft,parentRight,width}) {
 return start===length&&end===length&&parentRight-(caretLeft+2)>=width+8;
}
