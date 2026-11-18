import test from 'node:test';
import assert from 'node:assert/strict';
import {slashMenuLayout,slashDescriptionLayout,slashRowVisible,slashFilterFits} from '../src/slash-menu-layout.mjs';
test('slash floating menu uses actual width, no flip and the source size middleware budget',()=>{
 assert.deepEqual(slashMenuLayout({caret:{left:500,top:700},width:320,height:384,viewport:{width:800,height:800}}),{left:472,top:306,maxHeight:384});
 assert.deepEqual(slashMenuLayout({caret:{left:12,top:200},width:240,height:384,viewport:{width:390,height:800}}),{left:8,top:24,maxHeight:166});
});
test('description flips using its actual width and shifts by real wrapped height',()=>{
 const anchor={left:680,right:910,top:740,bottom:764};
 assert.deepEqual(slashDescriptionLayout({anchor,width:300,height:80,viewport:{width:1000,height:800}}),{side:'left',align:'end',maxWidth:416,left:372,top:684});
 // vendor-frame Ws defaults flipAlignment=true: left-end fits before shift is used.
 const p=slashDescriptionLayout({anchor:{left:20,right:252,top:300,bottom:324},width:400,height:68,viewport:{width:390,height:800}});assert.equal(p.side,'right');assert.equal(p.maxWidth,160);assert.equal(p.left,260);
});
test('description remains while a row is partially visible; fully clipped rows are hidden',()=>{
 const clip={left:0,right:240,top:20,bottom:180};
 assert.equal(slashRowVisible({left:4,right:236,top:10,bottom:34},clip),true);
 assert.equal(slashRowVisible({left:4,right:236,top:-4,bottom:20},clip),false);
 assert.equal(slashRowVisible({left:4,right:236,top:180,bottom:204},clip),false);
});
test('filter hint requires an end caret and the measured width plus the source8px breathing room',()=>{
 const p={start:1,end:1,length:1,caretLeft:20,parentRight:130,width:100};assert.equal(slashFilterFits(p),true);
 assert.equal(slashFilterFits({...p,parentRight:129}),false);assert.equal(slashFilterFits({...p,start:0}),false);assert.equal(slashFilterFits({...p,end:0}),false);
});
