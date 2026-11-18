import test from 'node:test';
import assert from 'node:assert/strict';
import {createFileCommentsStore,FILE_COMMENTS_PREFIX,fileCommentAttachmentKey} from '../src/file-comments-store.mjs';
import {serializeLineComment} from '../src/inline-comments.mjs';
import {makeSnippet,addSnippet,removeSnippetByKey,snippetText} from '../src/composer-attachments-model.mjs';
const fixture=()=>{const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};return {storage,values,store:createFileCommentsStore({scope:'session/file',storage})};};
test('range identity reactivates one card, normalizes snippets, and cancels edits independently of saved text',()=>{
 const {store}=fixture();assert.equal(store.create(3,2,'a\r\nb\n'),'2:3');store.edit('2:3',' explain ');assert.equal(store.create(2,3,'new'),'2:3');assert.equal(store.getSnapshot().entries.length,1);assert.equal(store.getSnapshot().entries[0].code,'a\nb');
 const saved=store.save('2:3');assert.equal(saved.body,'explain');assert.equal(store.getSnapshot().active,null);
 store.activate('2:3');store.edit('2:3','unsaved');store.cancel('2:3');assert.equal(store.getSnapshot().entries[0].body,'explain');
 store.create(7,7,'c');store.cancel('7:7');assert.equal(store.getSnapshot().entries.length,1);
});
test('nonempty drafts and saved comments survive remount/reload; abandoned empty cards drop on release',()=>{
 const {store,storage}=fixture();store.create(1,1,'code');store.edit('1:1','draft');store.create(2,2,'code');store.release();
 assert.deepEqual(store.getSnapshot().entries.map(e=>e.id),['1:1']);const restored=createFileCommentsStore({scope:'session/file',storage});assert.equal(restored.getSnapshot().entries[0].body,'draft');restored.save('1:1');restored.remove('1:1');assert.equal(storage.getItem(FILE_COMMENTS_PREFIX+'session/file'),null);
});
test('storage updates synchronize other windows while malformed storage and unavailable storage stay usable',()=>{
 const {storage}=fixture();let notify;const other=createFileCommentsStore({scope:'session/file',storage,subscribeStorage:fn=>{notify=fn;return()=>{};}});storage.setItem(FILE_COMMENTS_PREFIX+'session/file','{"bad":true}');notify({key:FILE_COMMENTS_PREFIX+'session/file'});assert.equal(other.getSnapshot().entries.length,0);
 const first=createFileCommentsStore({scope:'session/file',storage});first.create(2,2,'code');first.edit('2:2','body');first.save('2:2');notify({key:FILE_COMMENTS_PREFIX+'session/file'});assert.equal(other.getSnapshot().entries[0].savedBody,'body');
 const denied=createFileCommentsStore({scope:'x',storage:{getItem(){throw Error()},setItem(){throw Error()}}});denied.create(1,1,'');denied.edit('1:1','fine');assert.equal(denied.save('1:1').body,'fine');
});
test('saved comment attachment contains filename, full line snapshot and body; edit replaces it and delete detaches it',()=>{
 const key=fileCommentAttachmentKey('session/file','2:3');const text=serializeLineComment({path:'src/a.js',start:2,end:3,code:'one\ntwo',text:'fix these'});
 let attachments=addSnippet([],makeSnippet(text,{key}));assert.match(snippetText(attachments),/src\/a.js/);assert.match(snippetText(attachments),/fix these/);assert.match(snippetText(attachments),/> > one/);
 attachments=addSnippet(attachments,makeSnippet('updated',{key}));assert.equal(attachments.length,1);assert.match(snippetText(attachments),/updated/);assert.deepEqual(removeSnippetByKey(attachments,key),[]);
});
