import {randomUUID} from 'node:crypto';
import type {Database} from '../db/client';
import type {UploadStorage} from '../integrations/storage';
import type {RecallModel} from '../integrations/llm/claude-cli';
import type {VisionReader} from '../integrations/llm/vision';
import {requireId} from './studio';
import {createStudioJob,createStudioTextBatch,requireStaff,runStudioJob,transcribeStudioJob} from './ai-studio';
import {prepareUpload,UPLOAD_EXTENSIONS} from './extract-text';
// UPL-1 (PRD 4.1): up to 500 MB per batch. Browsers upload straight to private storage with a short-lived signed URL;
// a worker then reads one stored file at a time, so memory use is bounded by the largest single file, not the batch.
export const MAX_BATCH_BYTES=500*1024*1024;
export const MAX_BATCH_FILES=200;
// Per-file limits reflect what one serverless function can hold in memory while extracting or running OCR.
export const MAX_DOCUMENT_BYTES=100*1024*1024;
export const MAX_IMAGE_BYTES=25*1024*1024;
const IMAGES=['.png','.jpg','.jpeg','.webp','.gif','.heic','.heif'];
const MAX_ATTEMPTS=3;
const LEASE_MINUTES=6;
const ext=(name:string)=>name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]??'';
export type UploadTarget={id:string;name:string;url:string;method:'PUT'};
export type BeginInput={examId:string;sourceLabel:string;sittingHint:string;sittingId:string|null;requestId:string;files:{name:string;size:number}[]};
export function validateFiles(files:{name:string;size:number}[]) {
 if(!files.length)throw new Error('Choose at least one file.');
 if(files.length>MAX_BATCH_FILES)throw new Error(`Upload up to ${MAX_BATCH_FILES} files in one batch.`);
 let total=0;
 for(const f of files) {
  const name=String(f.name??'').trim();
  if(!name||name.length>200)throw new Error('Each file needs a name of up to 200 characters.');
  if(!UPLOAD_EXTENSIONS.includes(ext(name)))throw new Error(`${name.slice(0,80)} is not a supported file type. Use .txt, .csv, .tsv, .md, .pdf, .docx, .xlsx, .zip or an image.`);
  if(!Number.isSafeInteger(f.size)||f.size<1)throw new Error(`${name.slice(0,80)} is empty.`);
  const limit=IMAGES.includes(ext(name))?MAX_IMAGE_BYTES:MAX_DOCUMENT_BYTES;
  if(f.size>limit)throw new Error(`${name.slice(0,80)} is larger than ${Math.round(limit/1048576)} MB. Split or compress it first.`);
  total+=f.size;
 }
 if(total>MAX_BATCH_BYTES)throw new Error(`A batch can hold up to ${Math.round(MAX_BATCH_BYTES/1048576)} MB in total. Upload the rest as a second batch.`);
 return total;
}
export async function beginUploadBatch(db:Database,storage:UploadStorage,actorId:string,input:BeginInput):Promise<{batchId:string;uploads:UploadTarget[]}> {
 requireId(input.examId);requireId(input.requestId);if(input.sittingId)requireId(input.sittingId);
 await requireStaff(db,actorId,true);
 const label=input.sourceLabel.trim();if(!label||label.length>200)throw new Error('Provide a source label of up to 200 characters.');
 const total=validateFiles(input.files);
 const batch=await db.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[actorId+input.requestId]);
  const [existing]=await tx.query<{id:string}>('SELECT id FROM studio_upload_batches WHERE created_by=$1 AND request_id=$2',[actorId,input.requestId]);
  if(existing)return {id:existing.id,fresh:false};
  if(!(await tx.query('SELECT 1 FROM exams WHERE id=$1',[input.examId])).length)throw new Error('Exam not found.');
  if(input.sittingId&&!(await tx.query('SELECT 1 FROM sittings WHERE id=$1 AND exam_id=$2',[input.sittingId,input.examId])).length)throw new Error('Choose a sitting from this exam.');
  const [b]=await tx.query<{id:string}>('INSERT INTO studio_upload_batches(created_by,request_id,exam_id,source_label,sitting_hint,sitting_id,total_bytes,file_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
   [actorId,input.requestId,input.examId,label,input.sittingHint.trim().slice(0,120)||null,input.sittingId,total,input.files.length]);
  for(const f of input.files) {
   const id=randomUUID();
   await tx.query('INSERT INTO studio_uploads(id,batch_id,file_name,declared_bytes,storage_key) VALUES($1,$2,$3,$4,$5)',[id,b.id,f.name.trim(),f.size,`uploads/${b.id}/${id}`]);
  }
  await tx.query('INSERT INTO audit_log(actor_id,entity_id,action,after_json) VALUES($1,$2,$3,$4::jsonb)',[actorId,b.id,'upload_batch.created',JSON.stringify({examId:input.examId,files:input.files.length,bytes:total})]);
  return {id:b.id,fresh:true};
 });
 // A retried request gets fresh URLs for files that have not arrived yet.
 const rows=await db.query<{id:string;file_name:string;storage_key:string}>(`SELECT id,file_name,storage_key FROM studio_uploads WHERE batch_id=$1 AND status='pending' ORDER BY created_at`,[batch.id]);
 const uploads:UploadTarget[]=[];
 for(const r of rows){const t=await storage.uploadUrl(r.storage_key,3600);uploads.push({id:r.id,name:r.file_name,url:t.url,method:t.method});}
 return {batchId:batch.id,uploads};
}
async function ownedUpload(db:Database,actorId:string,uploadId:string) {
 requireId(uploadId);
 const [u]=await db.query<{id:string;status:string;storage_key:string;declared_bytes:string;batch_id:string}>(`SELECT u.id,u.status,u.storage_key,u.declared_bytes,u.batch_id FROM studio_uploads u JOIN studio_upload_batches b ON b.id=u.batch_id WHERE u.id=$1 AND b.created_by=$2`,[uploadId,actorId]);
 if(!u)throw new Error('Upload not found.');
 return u;
}
// The browser reports a finished upload; the server checks the stored size before trusting it.
export async function confirmUpload(db:Database,storage:UploadStorage,actorId:string,uploadId:string) {
 await requireStaff(db,actorId,true);
 const u=await ownedUpload(db,actorId,uploadId);
 if(u.status!=='pending')return {ok:true as const};
 const size=await storage.size(u.storage_key);
 if(size===null)return {ok:false as const,error:'The file has not arrived yet. Try uploading it again.'};
 if(size!==Number(u.declared_bytes)){await storage.remove(u.storage_key);return {ok:false as const,error:'The file was incomplete. Upload it again.'};}
 await db.query(`UPDATE studio_uploads SET status='uploaded',updated_at=now() WHERE id=$1 AND status='pending'`,[uploadId]);
 return {ok:true as const};
}
// Queues every confirmed file for processing; anything that never arrived is marked failed so the batch can finish.
export async function finishUploadBatch(db:Database,actorId:string,batchId:string) {
 await requireStaff(db,actorId,true);requireId(batchId);
 const [b]=await db.query('SELECT 1 FROM studio_upload_batches WHERE id=$1 AND created_by=$2',[batchId,actorId]);
 if(!b)throw new Error('Batch not found.');
 const queued=await db.query(`UPDATE studio_uploads SET status='queued',updated_at=now() WHERE batch_id=$1 AND status='uploaded' RETURNING id`,[batchId]);
 const missed=await db.query(`UPDATE studio_uploads SET status='failed',error='The upload did not finish. Add this file to a new batch.',updated_at=now() WHERE batch_id=$1 AND status='pending' RETURNING id`,[batchId]);
 await db.query('UPDATE studio_upload_batches SET finished_at=now() WHERE id=$1',[batchId]);
 return {queued:queued.length,missed:missed.length};
}
export type Deps={storage:UploadStorage;reader:VisionReader;model:RecallModel;runJobs?:boolean};
// Processes one queued file: read it from storage, extract text (OCR for scans), create sanitised jobs, then delete the
// stored object. Returns false when nothing was waiting. Safe to run from several workers: a file is claimed with a lease.
export async function processNextUpload(db:Database,deps:Deps):Promise<boolean> {
 const [u]=await db.query<{id:string;file_name:string;storage_key:string;batch_id:string;attempts:number}>(`UPDATE studio_uploads SET status='processing',attempts=attempts+1,lease_until=now()+make_interval(mins=>$1),updated_at=now()
  WHERE id=(SELECT id FROM studio_uploads WHERE attempts<$2 AND (status='queued' OR (status='processing' AND lease_until<now())) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING id,file_name,storage_key,batch_id,attempts`,[LEASE_MINUTES,MAX_ATTEMPTS]);
 if(!u)return false;
 const [b]=await db.query<{created_by:string;exam_id:string;source_label:string;sitting_hint:string|null;sitting_id:string|null}>('SELECT created_by,exam_id,source_label,sitting_hint,sitting_id FROM studio_upload_batches WHERE id=$1',[u.batch_id]);
 const fail=async(message:string)=>{await db.query(`UPDATE studio_uploads SET status='failed',error=$2,lease_until=NULL,updated_at=now() WHERE id=$1`,[u.id,message.slice(0,300)]);};
 try {
  const bytes=await deps.storage.read(u.storage_key);
  const prepared=await prepareUpload(u.file_name,bytes);
  const common={examId:b.exam_id,sourceLabel:`${b.source_label} — ${u.file_name}`.slice(0,200),fileName:u.file_name,sittingHint:b.sitting_hint??'',sittingId:b.sitting_id,requestId:u.id};
  let jobIds:string[];
  if(prepared.kind==='text') {
   jobIds=prepared.text.length>60000?await createStudioTextBatch(db,b.created_by,{...common,sourceText:prepared.text}):[await createStudioJob(db,b.created_by,{...common,sourceText:prepared.text})];
  } else {
   const jobId=await createStudioJob(db,b.created_by,{...common,sourceText:'',scanFiles:1});
   // A retry after a failed transcription puts the existing job back in the queue instead of creating another.
   await db.query(`UPDATE studio_jobs SET status='queued',error=NULL,started_at=NULL,finished_at=NULL WHERE id=$1 AND status='failed' AND ocr_files>0`,[jobId]);
   const ok=await transcribeStudioJob(db,jobId,[{name:u.file_name,mediaType:prepared.mediaType,bytes}],deps.reader);
   if(!ok){const [j]=await db.query<{error:string|null}>('SELECT error FROM studio_jobs WHERE id=$1',[jobId]);await db.query(`UPDATE studio_uploads SET job_ids=$2::jsonb WHERE id=$1`,[u.id,JSON.stringify([jobId])]);await fail(j?.error??'The scan could not be read.');return true;}
   jobIds=[jobId];
  }
  await db.query(`UPDATE studio_uploads SET status='done',job_ids=$2::jsonb,error=NULL,lease_until=NULL,processed_at=now(),updated_at=now() WHERE id=$1`,[u.id,JSON.stringify(jobIds)]);
  // The raw file is no longer needed once its sanitised text is in the job; a failed delete is retried by the sweep.
  await deps.storage.remove(u.storage_key).catch(()=>{});
  if(deps.runJobs!==false)await runStudioJob(db,jobIds[0],deps.model).catch(()=>{});
 } catch(error) {
  await fail(error instanceof Error&&!('query' in error)&&!('code' in error)?error.message:'This file could not be processed.');
 }
 return true;
}
// A worker that dies mid-file leaves the lease to expire; after three attempts the file is reported as failed.
export async function sweepUploads(db:Database,storage:UploadStorage) {
 const exhausted=await db.query(`UPDATE studio_uploads SET status='failed',error='Processing kept failing. Upload this file again.',lease_until=NULL WHERE status='processing' AND lease_until<now() AND attempts>=$1 RETURNING id`,[MAX_ATTEMPTS]);
 const old=await db.query<{id:string;storage_key:string}>(`UPDATE studio_uploads SET status='expired',updated_at=now() WHERE (status='pending' AND created_at<now()-interval '24 hours') OR (status IN ('failed','uploaded') AND updated_at<now()-interval '7 days') RETURNING id,storage_key`);
 for(const o of old)await storage.remove(o.storage_key).catch(()=>{});
 // Objects of finished files whose deletion failed earlier.
 const leftovers=await db.query<{storage_key:string}>(`SELECT storage_key FROM studio_uploads WHERE status='done' AND processed_at<now()-interval '1 hour' AND processed_at>now()-interval '3 days'`);
 for(const l of leftovers)await storage.remove(l.storage_key).catch(()=>{});
 return {exhausted:exhausted.length,expired:old.length};
}
export async function retryUpload(db:Database,storage:UploadStorage,actorId:string,uploadId:string) {
 await requireStaff(db,actorId,true);
 const u=await ownedUpload(db,actorId,uploadId);
 if(u.status!=='failed')throw new Error('Only failed files can be retried.');
 if((await storage.size(u.storage_key))===null)throw new Error('The stored file has expired. Upload it again in a new batch.');
 await db.query(`UPDATE studio_uploads SET status='queued',attempts=0,error=NULL,updated_at=now() WHERE id=$1`,[uploadId]);
}
export type BatchProgress={id:string;label:string;examName:string;createdAt:string;totalBytes:number;files:number;pending:number;queued:number;processing:number;done:number;failed:number;jobs:number;failures:{id:string;name:string;error:string|null}[]};
export async function listUploadBatches(db:Database,actorId:string):Promise<BatchProgress[]> {
 await requireStaff(db,actorId);
 const rows=await db.query<Record<string,unknown>>(`SELECT b.id,b.source_label,e.name AS exam_name,b.created_at::text,b.total_bytes,b.file_count,
  count(*) FILTER (WHERE u.status IN ('pending','uploaded'))::int AS pending,count(*) FILTER (WHERE u.status='queued')::int AS queued,count(*) FILTER (WHERE u.status='processing')::int AS processing,
  count(*) FILTER (WHERE u.status='done')::int AS done,count(*) FILTER (WHERE u.status IN ('failed','expired'))::int AS failed,
  COALESCE(sum(jsonb_array_length(u.job_ids)),0)::int AS jobs,
  COALESCE(jsonb_agg(jsonb_build_object('id',u.id,'name',u.file_name,'error',u.error)) FILTER (WHERE u.status IN ('failed','expired')),'[]'::jsonb) AS failures
  FROM studio_upload_batches b JOIN exams e ON e.id=b.exam_id JOIN studio_uploads u ON u.batch_id=b.id GROUP BY b.id,e.name ORDER BY b.created_at DESC LIMIT 10`);
 return rows.map(r=>({id:r.id as string,label:r.source_label as string,examName:r.exam_name as string,createdAt:r.created_at as string,totalBytes:Number(r.total_bytes),files:Number(r.file_count),pending:Number(r.pending),queued:Number(r.queued),processing:Number(r.processing),done:Number(r.done),failed:Number(r.failed),jobs:Number(r.jobs),failures:r.failures as BatchProgress['failures']}));
}
