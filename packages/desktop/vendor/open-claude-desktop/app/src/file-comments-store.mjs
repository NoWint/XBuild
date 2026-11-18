// Local session adapter for cd2efac6e Wc / c82eca2bd ot: one file comment per
// line range, draft bodies separate from saved bodies, editing never rewrites the file.
export const FILE_COMMENTS_PREFIX = 'epitaxy-file-comments:';
const stores = new Map();
const keyFor = (start, end) => `${start}:${end}`;
function validEntries(value) {
  return Array.isArray(value) ? value.filter(e => e && Number.isInteger(e.start) && e.start > 0 && Number.isInteger(e.end) && e.end >= e.start && typeof e.code === 'string' && typeof e.body === 'string' && (e.savedBody === undefined || typeof e.savedBody === 'string')).map(e => ({id:keyFor(e.start,e.end),start:e.start,end:e.end,code:e.code,body:e.body,...(e.savedBody !== undefined ? {savedBody:e.savedBody} : {})})) : [];
}
export function createFileCommentsStore({scope,storage,subscribeStorage=()=>()=>{}}) {
  const key=FILE_COMMENTS_PREFIX+scope, listeners=new Set();
  const read=()=>{try{return validEntries(JSON.parse(storage?.getItem(key)??'[]'));}catch{return [];}};
  let snapshot={entries:read(),active:null};
  const publish=(entries,active=snapshot.active)=>{
    snapshot={entries,active};
    try { entries.length ? storage?.setItem(key,JSON.stringify(entries)) : storage?.removeItem(key); } catch {}
    for(const listener of listeners)listener();
  };
  const off=subscribeStorage(event=>{if(event.key!==key&&event.key!==null)return;snapshot={entries:read(),active:null};for(const listener of listeners)listener();});
  return {
    getSnapshot:()=>snapshot,
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    create(start,end,code){
      if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<1)return null;
      [start,end]=[Math.min(start,end),Math.max(start,end)];const id=keyFor(start,end);
      const entries=snapshot.entries.some(e=>e.id===id)?snapshot.entries:[...snapshot.entries,{id,start,end,code:String(code).replace(/\r\n?|[\u2028\u2029]/g,'\n').trimEnd(),body:''}].sort((a,b)=>a.end-b.end||a.start-b.start);
      publish(entries,id);return id;
    },
    activate(id){if(snapshot.entries.some(e=>e.id===id))publish(snapshot.entries,id);},
    edit(id,body){publish(snapshot.entries.map(e=>e.id===id?{...e,body:String(body)}:e));},
    save(id){const entry=snapshot.entries.find(e=>e.id===id);if(!entry?.body.trim())return null;const saved={...entry,body:entry.body.trim(),savedBody:entry.body.trim()};publish(snapshot.entries.map(e=>e.id===id?saved:e),null);return saved;},
    cancel(id){publish(snapshot.entries.flatMap(e=>e.id!==id?[e]:e.savedBody===undefined?[]:[{...e,body:e.savedBody}]),snapshot.active===id?null:snapshot.active);},
    remove(id){publish(snapshot.entries.filter(e=>e.id!==id),snapshot.active===id?null:snapshot.active);},
    release(){publish(snapshot.entries.filter(e=>e.savedBody!==undefined||e.body.trim()),null);},
    dispose(){off();listeners.clear();},
  };
}
export function fileCommentsStore(scope) {
  if(!stores.has(scope)) {
    let storage;try{storage=globalThis.localStorage;}catch{}
    stores.set(scope,createFileCommentsStore({scope,storage,subscribeStorage:fn=>{globalThis.addEventListener?.('storage',fn);return()=>globalThis.removeEventListener?.('storage',fn);}}));
  }
  return stores.get(scope);
}
export const fileCommentAttachmentKey=(scope,id)=>`file-comment:${scope}:${id}`;
