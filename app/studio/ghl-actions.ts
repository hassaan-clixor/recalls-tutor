'use server';
import {revalidatePath} from 'next/cache';
import {getCurrentActor} from '@/lib/auth/session';
import {staffAccess} from '@/lib/auth/actor';
import {getDatabase} from '@/lib/db/client';
import {backfillGhl,createGhlConnection,deleteGhlConnection,retryGhlEvent,testGhlConnection,updateGhlConnection,GHL_EVENTS,runGhlSync} from '@/lib/services/ghl';
import {ghlBandFor} from '@/lib/integrations/ghl-jobs';
// GHL admin actions. The services re-check Super Admin on every call; the token is only ever written, never read back.
export type GhlResult={error?:string;success?:string};
const field=(form:FormData,key:string)=>{const v=form.get(key);return typeof v==='string'?v:'';};
async function actorId() {const a=await getCurrentActor();if(staffAccess(a)!=='allowed'||!a)throw new Error('Staff access is required.');return a.id;}
function failure(error:unknown):GhlResult {return {error:error instanceof Error&&!('query' in error)&&!('code' in error)?error.message:'Unable to save this change. Please retry.'};}
const refresh=()=>revalidatePath('/studio/integrations');
function json(value:string,label:string) {
 if(!value.trim())return undefined;
 try {const parsed=JSON.parse(value);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed;}
 catch {throw new Error(`${label} must be valid JSON, for example {"key":"value"}.`);}
}
export async function newConnection(_:GhlResult,form:FormData):Promise<GhlResult> {
 try {await createGhlConnection(getDatabase(),await actorId(),{name:field(form,'name'),locationId:field(form,'locationId'),token:field(form,'token'),examId:field(form,'examId')||null});refresh();return {success:'Connection saved. Test it, then map fields and turn on the events you want.'};}catch(e){return failure(e);}
}
export async function saveConnection(_:GhlResult,form:FormData):Promise<GhlResult> {
 try {
  const events=GHL_EVENTS.filter(e=>form.get(`event:${e}`)==='on');
  await updateGhlConnection(getDatabase(),await actorId(),field(form,'id'),{enabled:form.get('enabled')==='on',events,token:field(form,'token')||undefined,
   tagMap:json(field(form,'tagMap'),'Tags')??{},fieldMap:json(field(form,'fieldMap'),'Field mapping')??{},pipelineMap:json(field(form,'pipelineMap'),'Pipeline mapping')??{}});
  refresh();return {success:'Saved.'};
 } catch(e){return failure(e);}
}
export async function testConnection(_:GhlResult,form:FormData):Promise<GhlResult> {
 try {const r=await testGhlConnection(getDatabase(),await actorId(),field(form,'id'));refresh();return r.ok?{success:'Connected: GoHighLevel accepted the token for this location.'}:{error:r.error};}catch(e){return failure(e);}
}
export async function backfill(_:GhlResult,form:FormData):Promise<GhlResult> {
 try {const n=await backfillGhl(getDatabase(),await actorId(),field(form,'id'));refresh();return {success:n?`${n} contacts queued. They are sent in the background.`:'Nothing new to queue.'};}catch(e){return failure(e);}
}
export async function removeConnection(_:GhlResult,form:FormData):Promise<GhlResult> {
 try {await deleteGhlConnection(getDatabase(),await actorId(),field(form,'id'));refresh();return {success:'Connection and its sync log removed.'};}catch(e){return failure(e);}
}
export async function retryEvent(_:GhlResult,form:FormData):Promise<GhlResult> {
 try {const db=getDatabase();await retryGhlEvent(db,await actorId(),field(form,'id'));await runGhlSync(db,{bandFor:ghlBandFor}).catch(()=>null);refresh();return {success:'Queued again.'};}catch(e){return failure(e);}
}
