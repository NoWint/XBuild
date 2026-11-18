import test from 'node:test';
import assert from 'node:assert/strict';
import {FILE_TAB_LABELS,tabDetail,tabRelativePath,tabTooltip,tabMenuItems,insertFileTab,moveFileTab,fileTabsToRight} from '../src/file-tab-menu-model.mjs';
const labels=options=>tabMenuItems(options).map(item=>item.label);
test('tab menu items follow he popup order (panes-tabs-current.js:470-485)',()=>{
 assert.deepEqual(labels({preview:true,solo:false}),['Keep open','Close file','Close other files','Close all files']);
 assert.deepEqual(labels({preview:false,solo:false}),['Close file','Close other files','Close all files']);
 assert.deepEqual(labels({preview:false,solo:true}),['Close file']);
 assert.deepEqual(labels({preview:true,solo:true}),['Keep open','Close file']);
 assert.deepEqual(tabMenuItems({preview:true}).map(item=>item.action),['keep','close','close-others','close-all']);
 assert.equal(FILE_TAB_LABELS.closeTab,'Close file');assert.equal(FILE_TAB_LABELS.previewTabHint,'preview');
});
test('tab detail is the workspace-relative directory (panes-tile-current.js:6656-6668 ce)',()=>{
 assert.equal(tabDetail('src/a/b.ts'),'src/a');
 assert.equal(tabDetail('README.md'),undefined);
 assert.equal(tabDetail('/work/space/src/a/b.ts','/work/space'),'src/a');
 assert.equal(tabDetail('/work/space/README.md','/work/space/'),undefined);
 assert.equal(tabDetail('./nested/deep.txt','/work/space'),'nested');
 assert.equal(tabDetail('/a.txt','/elsewhere'),'/');
 assert.equal(tabDetail('/other/x/y.txt','/work/space'),'/other/x');
 assert.equal(tabRelativePath('/work/spacey/a.txt','/work/space'),'/work/spacey/a.txt');
});
test('tooltip content only when there is a detail or the label is clipped; suppressed while the menu is open',()=>{
 assert.deepEqual(tabTooltip({label:'README.md',detail:undefined,clipped:false}),{content:null,detail:undefined});
 assert.deepEqual(tabTooltip({label:'README.md',detail:undefined,clipped:true}),{content:'README.md',detail:undefined});
 assert.deepEqual(tabTooltip({label:'deep.txt',detail:'nested'}),{content:'deep.txt',detail:'nested'});
 assert.deepEqual(tabTooltip({label:'deep.txt',detail:'nested',suppressed:true}),{content:null,detail:null});
});
test('overflow and reorder labels (panes-tile-current.js:6669-6710 le)',()=>{
 assert.equal(FILE_TAB_LABELS.moreTabs,'More files');
 assert.equal(FILE_TAB_LABELS.closeTabHint,'press right arrow to close');
 assert.equal(FILE_TAB_LABELS.moveTabHint,'Press Control+Shift+Left Arrow or Right Arrow to move the file');
});
test('insertFileTab follows F (panes-state-current.js:1596-1616)',()=>{
 const a={path:'a',preview:false,openSequence:1},P={path:'p',preview:true,openSequence:2},b={path:'b',preview:false,openSequence:3};
 const c={path:'c',preview:true,openSequence:4};
 assert.deepEqual(insertFileTab([a,P,b],c).map(t=>t.path),['a','c','b'],'a preview replaces the preview tab in its slot');
 const pinned={path:'c',preview:false,openSequence:4};
 assert.deepEqual(insertFileTab([a,P,b],pinned).map(t=>t.path),['a','p','b','c'],'a pinned open appends');
 const again={...b,preview:false,text:'x'};
 const same=insertFileTab([a,P,b],again);assert.deepEqual(same.map(t=>t.path),['a','p','b']);assert.equal(same[2],again,'the same path is replaced in place');
 const list=[a,P,b];assert.equal(insertFileTab(list,P),list,'the identical tab keeps the list');
 const eight=Array.from({length:8},(_,i)=>({path:`f${i}`,preview:false,openSequence:[5,3,9,1,7,2,8,6][i]}));
 const ninth={path:'n',preview:false,openSequence:10};
 assert.deepEqual(insertFileTab(eight,ninth).map(t=>t.path),['f0','f1','f2','f4','f5','f6','f7','n'],'the 9th open evicts the lowest openSequence (f3)');
 assert.deepEqual(insertFileTab(eight,ninth,'f3').map(t=>t.path),['f0','f1','f2','f3','f4','f6','f7','n'],'keepPath is never evicted (f5 next)');
 const restored=[{path:'r',preview:false},...eight.slice(1)];
 assert.deepEqual(insertFileTab(restored,ninth).map(t=>t.path)[0],'f1','a tab without openSequence (restored) goes first');
});
test('moveFileTab moves one slot, never into a hidden slot',()=>{
 const tabs=['a','b','c','d'].map(path=>({path}));
 assert.deepEqual(moveFileTab(tabs,'b',1).map(t=>t.path),['a','c','b','d']);
 assert.deepEqual(moveFileTab(tabs,'b',-1).map(t=>t.path),['b','a','c','d']);
 assert.equal(moveFileTab(tabs,'a',-1),tabs);assert.equal(moveFileTab(tabs,'d',1),tabs);
 assert.equal(moveFileTab(tabs,'c',1,['d']),tabs,'d is behind More files');
});

test('close-right follows the current tab order, hides at the last tab and ignores missing tabs',()=>{
 const tabs=['a','b','c'].map(path=>({path}));
 assert.deepEqual(fileTabsToRight(tabs,'b'),['c']);
 assert.deepEqual(fileTabsToRight(moveFileTab(tabs,'c',-1),'c'),['b']);
 assert.deepEqual(fileTabsToRight(tabs,'c'),[]);
 assert.deepEqual(fileTabsToRight(tabs,'missing'),[]);
 assert.deepEqual(labels({hasTabsToRight:true}),['Close file','Close other files','Close files to the right','Close all files']);
 assert.ok(!labels({hasTabsToRight:false}).includes('Close files to the right'));
});
