import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {embeddedDatabase} from '../lib/db/client';
import {migrate} from '../lib/db/migrate';
import {seedCatalogue} from '../lib/db/seed';
import {listExams} from '../lib/services/catalogue';
import {localStorageAdapter,localToken,presign,s3Storage,validLocalToken} from '../lib/integrations/storage';
import {beginUploadBatch,confirmUpload,finishUploadBatch,listUploadBatches,MAX_BATCH_BYTES,processNextUpload,retryUpload,sweepUploads,validateFiles} from '../lib/services/upload-batches';
import type {VisionReader} from '../lib/integrations/llm/vision';
import type {RecallModel} from '../lib/integrations/llm/claude-cli';
test('SigV4 presigning matches the published AWS example, and path style puts the bucket in the path',()=>{
 const url=presign({endpoint:'https://s3.amazonaws.com',region:'us-east-1',bucket:'examplebucket',accessKeyId:'AKIAIOSFODNN7EXAMPLE',secretAccessKey:'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',pathStyle:false},'GET','test.txt',86400,new Date('2013-05-24T00:00:00Z'));
 assert.equal(url,'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
 const path=presign({endpoint:'https://x.r2.example.com',region:'auto',bucket:'bkt',accessKeyId:'AK',secretAccessKey:'SK',pathStyle:true},'PUT','uploads/a b/c',600);
 assert.ok(path.startsWith('https://x.r2.example.com/bkt/uploads/a%20b/c?'));
});
test('S3 adapter uses signed requests, reports missing objects and never leaks the secret',async()=>{
 const calls:{url:string;method:string}[]=[];
 const fake=(async(url:string|URL|Request,init?:RequestInit)=>{calls.push({url:String(url),method:init?.method??'GET'});
  if(init?.method==='HEAD')return String(url).includes('missing')?new Response(null,{status:404}):new Response(null,{status:200,headers:{'content-length':'42'}});
  return new Response(new Uint8Array([1,2,3]),{status:200});}) as typeof fetch;
 const s=s3Storage({endpoint:'https://s3.example.com',region:'auto',bucket:'b',accessKeyId:'AKID',secretAccessKey:'TOPSECRET',pathStyle:true},fake);
 assert.equal(await s.size('uploads/x/ok'),42);assert.equal(await s.size('uploads/x/missing'),null);
 assert.deepEqual([...await s.read('uploads/x/ok')],[1,2,3]);await s.remove('uploads/x/ok');
 assert.deepEqual(calls.map(c=>c.method),['HEAD','HEAD','GET','DELETE']);
 assert.ok(calls.every(c=>c.url.includes('X-Amz-Signature=')&&!c.url.includes('TOPSECRET')));
 assert.ok(!(await s.uploadUrl('uploads/x/y',600)).url.includes('TOPSECRET'));
});
test('local upload links are signed, expire and cannot be reused for another file',()=>{
 const exp=Math.floor(Date.now()/1000)+60,token=localToken('secret','uploads/a/b',exp);
 assert.ok(validLocalToken('secret','uploads/a/b',exp,token));
 assert.ok(!validLocalToken('secret','uploads/a/c',exp,token));assert.ok(!validLocalToken('other','uploads/a/b',exp,token));
 assert.ok(!validLocalToken('secret','uploads/a/b',exp-120,localToken('secret','uploads/a/b',exp-120)));
});
test('batch rules: 500 MB total, per-file limits, types and counts',()=>{
 assert.equal(validateFiles([{name:'a.pdf',size:1000}]),1000);
 assert.throws(()=>validateFiles([]),/at least one/);
 assert.throws(()=>validateFiles([{name:'a.exe',size:5}]),/not a supported file type/);
 assert.throws(()=>validateFiles([{name:'a.pdf',size:0}]),/empty/);
 assert.throws(()=>validateFiles([{name:'a.png',size:26*1024*1024}]),/larger than 25 MB/);
 assert.throws(()=>validateFiles([{name:'a.pdf',size:101*1024*1024}]),/larger than 100 MB/);
 assert.throws(()=>validateFiles(Array.from({length:201},(_,i)=>({name:`f${i}.txt`,size:10}))),/up to 200 files/);
 assert.equal(validateFiles(Array.from({length:5},(_,i)=>({name:`f${i}.pdf`,size:100*1024*1024}))),500*1024*1024);
 assert.throws(()=>validateFiles([...Array.from({length:5},(_,i)=>({name:`f${i}.pdf`,size:100*1024*1024})),{name:'g.txt',size:1}]),/500 MB in total/);
 assert.equal(MAX_BATCH_BYTES,500*1024*1024);
});
test('large upload batches: signed uploads, size checks, per-file processing, retries, cleanup and idempotency',async()=>{
 const db=embeddedDatabase(new PGlite()),root=await mkdtemp(path.join(os.tmpdir(),'rt-uploads-'));
 try {
  await migrate(db);await seedCatalogue(db);
  const storage=localStorageAdapter({root,secret:'secret',baseUrl:'http://127.0.0.1:3000'});
  const exam=(await listExams(db))[0];
  async function account(role:string) {
   const authId=randomUUID();await db.query('INSERT INTO auth_users(id,name,email,email_verified,two_factor_enabled,created_at,updated_at) VALUES($1,$2,$3,true,true,now(),now())',[authId,'Staff',`${authId.slice(0,8)}@example.test`]);
   return (await db.query<{id:string}>('INSERT INTO app_users(auth_id,role) VALUES($1,$2) RETURNING id',[authId,role]))[0].id;
  }
  const manager=await account('content_manager'),reviewer=await account('reviewer'),other=await account('content_manager');
  const requestId=randomUUID();
  const small='Recall 1: nerve supply to levator ani. Options were pudendal, obturator, sciatic.\nRecall 2: first line drug for hyperemesis.';
  const big=Array.from({length:3000},(_,i)=>`Recall ${i}: a candidate remembered a question about topic ${i} with details and options.`).join('\n');
  const reader:VisionReader={name:'fake-ocr',async read(i){return {text:`Transcribed ${i.fileName}: recall about uterine artery.`,model:'fake-ocr',costUsd:null};}};
  const model:RecallModel={name:'fake',async complete(){return {output:{drafts:[],noise_summary:'none'},model:'fake',costUsd:null};}};
  const files=[{name:'chat.txt',size:small.length},{name:'long.txt',size:big.length},{name:'scan.png',size:(await readFile('tests/fixtures/ocr-sample.png')).length},{name:'never.txt',size:10}];
  const input={examId:exam.id,sourceLabel:'Sep 2026 dump',sittingHint:'September 2026',sittingId:null,requestId,files};
  await assert.rejects(beginUploadBatch(db,storage,reviewer,input),/permission/);
  const begun=await beginUploadBatch(db,storage,manager,input);
  assert.equal(begun.uploads.length,4);
  assert.ok(begun.uploads.every(u=>u.url.includes('/api/studio/uploads/')&&u.url.includes('token=')&&!u.url.includes(u.name)));
  // Retrying the same request returns the same batch, not a second one.
  assert.equal((await beginUploadBatch(db,storage,manager,input)).batchId,begun.batchId);
  assert.equal((await db.query('SELECT 1 FROM studio_upload_batches')).length,1);
  const byName=(n:string)=>begun.uploads.find(u=>u.name===n)!;
  const key=(id:string)=>db.query<{storage_key:string}>('SELECT storage_key FROM studio_uploads WHERE id=$1',[id]).then(r=>r[0].storage_key);
  // Another staff member cannot confirm or retry someone else's file.
  await assert.rejects(confirmUpload(db,storage,other,byName('chat.txt').id),/not found/);
  // A file that has not arrived, or arrived incomplete, is not accepted.
  assert.equal((await confirmUpload(db,storage,manager,byName('chat.txt').id)).ok,false);
  await storage.write(await key(byName('chat.txt').id),new TextEncoder().encode('short'));
  const partial=await confirmUpload(db,storage,manager,byName('chat.txt').id);assert.equal(partial.ok,false);
  assert.equal(await storage.size(await key(byName('chat.txt').id)),null,'an incomplete object is discarded');
  await storage.write(await key(byName('chat.txt').id),new TextEncoder().encode(small));
  await storage.write(await key(byName('long.txt').id),new TextEncoder().encode(big));
  await storage.write(await key(byName('scan.png').id),new Uint8Array(await readFile('tests/fixtures/ocr-sample.png')));
  for(const n of ['chat.txt','long.txt','scan.png'])assert.equal((await confirmUpload(db,storage,manager,byName(n).id)).ok,true);
  const done=await finishUploadBatch(db,manager,begun.batchId);
  assert.deepEqual(done,{queued:3,missed:1});
  // Process every file, one at a time.
  const deps={storage,reader,model,runJobs:false};
  let n=0;while(await processNextUpload(db,deps))n++;
  assert.equal(n,3);
  const [batch]=await listUploadBatches(db,manager);
  assert.equal(batch.done,3);assert.equal(batch.failed,1);assert.equal(batch.failures[0].name,'never.txt');
  // Small text: one job. Long text: split into several jobs, none dropped. Scan: OCR text reached the job.
  const jobsFor=async(name:string)=>(await db.query<{job_ids:string[]}>('SELECT job_ids FROM studio_uploads WHERE file_name=$1',[name]))[0].job_ids;
  assert.equal((await jobsFor('chat.txt')).length,1);
  const longJobs=await jobsFor('long.txt');assert.ok(longJobs.length>=2,`long text split, got ${longJobs.length}`);
  const joined=(await db.query<{source_text:string}>('SELECT source_text FROM studio_jobs WHERE id=ANY($1::uuid[]) ORDER BY created_at,id',[longJobs])).map(r=>r.source_text).join('\n');
  for(const i of [0,1500,2999])assert.ok(joined.includes(`Recall ${i}:`),`recall ${i} survived splitting`);
  const [scanJob]=await db.query<{source_text:string;ocr_files:number}>('SELECT source_text,ocr_files FROM studio_jobs WHERE id=$1',[(await jobsFor('scan.png'))[0]]);
  assert.match(scanJob.source_text,/Transcribed scan\.png/);assert.equal(scanJob.ocr_files,0);
  // Stored objects are deleted after processing.
  for(const f of ['chat.txt','long.txt','scan.png'])assert.equal(await storage.size((await db.query<{storage_key:string}>('SELECT storage_key FROM studio_uploads WHERE file_name=$1',[f]))[0].storage_key),null);
  // Reprocessing is idempotent: no extra jobs appear.
  const jobCount=(await db.query('SELECT 1 FROM studio_jobs')).length;
  await db.query(`UPDATE studio_uploads SET status='queued',attempts=0 WHERE file_name='chat.txt'`);
  await storage.write(await key(byName('chat.txt').id),new TextEncoder().encode(small));
  await processNextUpload(db,deps);assert.equal((await db.query('SELECT 1 FROM studio_jobs')).length,jobCount);
  // A corrupt file fails with a clear message, keeps its object for a retry, and the batch still finishes.
  const second=await beginUploadBatch(db,storage,manager,{...input,requestId:randomUUID(),files:[{name:'broken.png',size:12},{name:'ok.txt',size:small.length}]});
  const broken=second.uploads.find(u=>u.name==='broken.png')!,ok=second.uploads.find(u=>u.name==='ok.txt')!;
  await storage.write(await key(broken.id),new TextEncoder().encode('not an image'));await storage.write(await key(ok.id),new TextEncoder().encode(small));
  await confirmUpload(db,storage,manager,broken.id);await confirmUpload(db,storage,manager,ok.id);await finishUploadBatch(db,manager,second.batchId);
  while(await processNextUpload(db,deps));
  const [brokenRow]=await db.query<{status:string;error:string}>('SELECT status,error FROM studio_uploads WHERE id=$1',[broken.id]);
  assert.equal(brokenRow.status,'failed');assert.match(brokenRow.error,/not a valid image/);
  assert.equal((await db.query<{status:string}>('SELECT status FROM studio_uploads WHERE id=$1',[ok.id]))[0].status,'done');
  assert.notEqual(await storage.size(await key(broken.id)),null,'a failed file stays available for retry');
  await storage.write(await key(broken.id),new Uint8Array(await readFile('tests/fixtures/ocr-sample.png')));
  await retryUpload(db,storage,manager,broken.id);
  await assert.rejects(retryUpload(db,storage,manager,ok.id),/Only failed/);
  // A worker that died mid-file is recovered after its lease, and gives up after three attempts.
  await db.query(`UPDATE studio_uploads SET status='processing',lease_until=now()-interval '1 minute',attempts=3 WHERE id=$1`,[broken.id]);
  assert.equal((await sweepUploads(db,storage)).exhausted,1);
  assert.equal((await db.query<{status:string}>('SELECT status FROM studio_uploads WHERE id=$1',[broken.id]))[0].status,'failed');
  // Abandoned and old failed files expire and their objects are removed.
  await db.query(`UPDATE studio_uploads SET updated_at=now()-interval '8 days' WHERE id=$1`,[broken.id]);
  assert.equal((await sweepUploads(db,storage)).expired,1);
  assert.equal(await storage.size(await key(broken.id)),null);
 } finally {await db.close();}
});
