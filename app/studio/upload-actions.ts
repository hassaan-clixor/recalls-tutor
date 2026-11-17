'use server';
import {after} from 'next/server';
import {revalidatePath} from 'next/cache';
import {getCurrentActor} from '@/lib/auth/session';
import {staffAccess} from '@/lib/auth/actor';
import {getDatabase} from '@/lib/db/client';
import {configuredStorage} from '@/lib/integrations/storage';
import {defaultRecallModel} from '@/lib/integrations/llm/anthropic';
import {defaultVisionReader} from '@/lib/integrations/llm/vision';
import {beginUploadBatch,confirmUpload,finishUploadBatch,processNextUpload,retryUpload,type UploadTarget} from '@/lib/services/upload-batches';
// UPL-1 actions. Only small JSON crosses these functions; the files themselves go from the browser to storage.
export type BigUploadResult={error?:string;batchId?:string;uploads?:UploadTarget[];ok?:boolean;queued?:number;missed?:number};
async function actorId() {const a=await getCurrentActor();if(staffAccess(a)!=='allowed'||!a)throw new Error('Staff access is required.');return a.id;}
function failure(error:unknown):BigUploadResult {return {error:error instanceof Error&&!('query' in error)&&!('code' in error)?error.message:'Unable to continue this upload. Please retry.'};}
function storage() {const s=configuredStorage();if(!s)throw new Error('Large uploads are not configured yet. Ask the administrator to set the STORAGE_* variables.');return s;}
export async function beginBigUpload(input:{examId:string;sourceLabel:string;sittingHint:string;sittingId:string|null;requestId:string;files:{name:string;size:number}[]}):Promise<BigUploadResult> {
 try {const r=await beginUploadBatch(getDatabase(),storage(),await actorId(),input);return {batchId:r.batchId,uploads:r.uploads};}catch(e){return failure(e);}
}
export async function confirmBigUpload(uploadId:string):Promise<BigUploadResult> {
 try {const r=await confirmUpload(getDatabase(),storage(),await actorId(),uploadId);return r.ok?{ok:true}:{ok:false,error:r.error};}catch(e){return failure(e);}
}
export async function finishBigUpload(batchId:string):Promise<BigUploadResult> {
 try {
  const id=await actorId(),db=getDatabase(),s=storage();
  const r=await finishUploadBatch(db,id,batchId);
  // The first file starts now; the scheduled worker continues with the rest, one at a time.
  after(()=>processNextUpload(db,{storage:s,reader:defaultVisionReader(),model:defaultRecallModel()}).catch(()=>{}));
  revalidatePath('/studio');return {ok:true,queued:r.queued,missed:r.missed};
 } catch(e){return failure(e);}
}
export async function retryBigUpload(uploadId:string):Promise<BigUploadResult> {
 try {const db=getDatabase(),s=storage();await retryUpload(db,s,await actorId(),uploadId);after(()=>processNextUpload(db,{storage:s,reader:defaultVisionReader(),model:defaultRecallModel()}).catch(()=>{}));revalidatePath('/studio');return {ok:true};}catch(e){return failure(e);}
}
