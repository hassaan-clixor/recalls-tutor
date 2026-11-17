import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {embeddedDatabase} from '../lib/db/client';
import {migrate} from '../lib/db/migrate';
import {seedCatalogue} from '../lib/db/seed';
import {listExams} from '../lib/services/catalogue';
import {createRecall,getStudioQuestion,saveStudioDraft,reviewStudioQuestion} from '../lib/services/studio';
import {autoMergeThreshold,createStudioJob,runStudioJob} from '../lib/services/ai-studio';
import {createSitting} from '../lib/services/catalogue-admin';
import type {RecallModel} from '../lib/integrations/llm/claude-cli';

test('opt-in semantic merging preserves evidence and sitting without publishing changes',async()=>{
 const previous=process.env.DEDUPE_AUTO_MERGE_THRESHOLD;process.env.DEDUPE_AUTO_MERGE_THRESHOLD='0.92';
 const db=embeddedDatabase(new PGlite());try{
  await migrate(db);await seedCatalogue(db);
  async function actor(role:string){const auth=randomUUID();await db.query('INSERT INTO auth_users(id,name,email,email_verified,two_factor_enabled,created_at,updated_at) VALUES($1,$2,$3,true,false,now(),now())',[auth,role,`${auth}@example.test`]);return (await db.query<{id:string}>('INSERT INTO app_users(auth_id,role) VALUES($1,$2) RETURNING id',[auth,role]))[0].id;}
  const manager=await actor('content_manager'),reviewer=await actor('reviewer'),exam=(await listExams(db))[0];
  const target=await createRecall(db,manager,{examId:exam.id,sourceLabel:'Original',sourceText:'Original evidence',requestId:randomUUID()});
  const original=(await getStudioQuestion(db,reviewer,target))!;
  const version=await saveStudioDraft(db,reviewer,target,original.versionId,{stem:'Original clinical question',options:['A','B','C','D','E'],correctAnswer:0,explanation:'Explanation',references:['Reference']});
  await reviewStudioQuestion(db,reviewer,target,version,'submit_review',false,'');await reviewStudioQuestion(db,reviewer,target,version,'approve',true,'');await reviewStudioQuestion(db,manager,target,version,'publish',false,'');
  const sitting=await createSitting(db,manager,{examId:exam.id,year:2026,month:9,label:''});
  const job=await createStudioJob(db,manager,{examId:exam.id,sourceLabel:'New recall',sourceText:'Synthetic new evidence',fileName:null,sittingHint:'',sittingId:sitting,requestId:randomUUID()});
  const draft={evidence:'Synthetic new evidence',stem:'Same clinical question rephrased',options:['A','B','C','D','E'],correct_index:0,explanation:'Explanation',distractor_rationales:['a','b','c','d','e'],key_notes:['a','b','c'],references:[{title:'Reference',source:'Synthetic',section:'1'}],topic:'',difficulty:'medium',confidence:90,needs_expert:false,answer_basis:'established_knowledge',issues:[]};
  const model:RecallModel={name:'mock',async complete(){return {output:{drafts:[draft],noise_summary:''},model:'mock',costUsd:null};}};
  await runStudioJob(db,job,model,{name:'mock-embedding',async embed(texts){return texts.map(()=>[1,0]);}});
  const [result]=await db.query<{status:string;draft_count:number;merged_count:number}>('SELECT status,draft_count,merged_count FROM studio_jobs WHERE id=$1',[job]);
  assert.deepEqual(result,{status:'ready',draft_count:0,merged_count:1});
  assert.equal((await db.query('SELECT 1 FROM questions WHERE exam_id=$1',[exam.id])).length,1);
  assert.equal((await db.query('SELECT 1 FROM semantic_merge_evidence WHERE target_question_id=$1 AND job_id=$2',[target,job])).length,1);
  assert.equal((await db.query('SELECT 1 FROM question_sittings WHERE question_id=$1 AND sitting_id=$2',[target,sitting])).length,1);
  assert.equal((await getStudioQuestion(db,reviewer,target))!.versionId,version);
  assert.equal((await db.query("SELECT 1 FROM question_proposals WHERE question_id=$1 AND status='pending'",[target])).length,1);
  const batch=await createStudioJob(db,manager,{examId:exam.id,sourceLabel:'Batch',sourceText:'Two synthetic recalls',fileName:null,sittingHint:'',sittingId:sitting,requestId:randomUUID()});
  const batchModel:RecallModel={name:'batch',async complete(){return {output:{drafts:[{...draft,stem:'Batch question one'},{...draft,stem:'Batch question restated'}],noise_summary:''},model:'batch',costUsd:null};}};
  await runStudioJob(db,batch,batchModel,{name:'mock-embedding',async embed(texts){return texts.map(text=>text.startsWith('Batch question')?[1,0]:[0,1]);}});
  const [batchResult]=await db.query<{draft_count:number;merged_count:number;status:string}>('SELECT draft_count,merged_count,status FROM studio_jobs WHERE id=$1',[batch]);
  assert.deepEqual(batchResult,{draft_count:1,merged_count:1,status:'ready'});
  assert.equal((await db.query('SELECT 1 FROM semantic_merge_evidence WHERE job_id=$1',[batch])).length,1);
  const review=await createStudioJob(db,manager,{examId:exam.id,sourceLabel:'Possible match',sourceText:'Synthetic review evidence',fileName:null,sittingHint:'',sittingId:null,requestId:randomUUID()});
  const reviewModel:RecallModel={name:'review',async complete(){return {output:{drafts:[{...draft,stem:'Needs human comparison'}],noise_summary:''},model:'review',costUsd:null};}};
  await runStudioJob(db,review,reviewModel,{name:'mock-embedding',async embed(texts){return texts.map(text=>text==='Needs human comparison'?[0.85,Math.sqrt(1-0.85**2)]:[1,0]);}});
  const [reviewResult]=await db.query<{draft_count:number;merged_count:number}>('SELECT draft_count,merged_count FROM studio_jobs WHERE id=$1',[review]);
  assert.deepEqual(reviewResult,{draft_count:1,merged_count:0});
  assert.throws(()=>autoMergeThreshold('0.8'));assert.equal(autoMergeThreshold(undefined),null);
 }finally{await db.close();if(previous===undefined)delete process.env.DEDUPE_AUTO_MERGE_THRESHOLD;else process.env.DEDUPE_AUTO_MERGE_THRESHOLD=previous;}
});
