import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {embeddedDatabase} from '../lib/db/client';
import {migrate} from '../lib/db/migrate';
import {seedCatalogue} from '../lib/db/seed';
import {listExams} from '../lib/services/catalogue';
import {BULK_APPROVE_MAX,bulkApproveStudioQuestions,createRecall,getStudioQuestion,reviewStudioQuestion,saveStudioDraft} from '../lib/services/studio';
test('Bulk approval: only confident, unflagged drafts in review; each is audited; nothing is published',async()=>{
 const db=embeddedDatabase(new PGlite());
 try {
  await migrate(db);await seedCatalogue(db);
  async function actor(role:string) {const authId=randomUUID();await db.query('INSERT INTO auth_users(id,name,email,email_verified,two_factor_enabled,created_at,updated_at) VALUES($1,$2,$3,true,true,now(),now())',[authId,role,`${authId}@example.test`]);return (await db.query<{id:string}>('INSERT INTO app_users(auth_id,role) VALUES($1,$2) RETURNING id',[authId,role]))[0];}
  const manager=await actor('content_manager'),reviewer=await actor('reviewer'),student=await actor('student');
  const exam=(await listExams(db))[0];
  const make=async(n:number,confidence:number|null,needsExpert=false,submit=true)=>{
   const id=await createRecall(db,manager.id,{examId:exam.id,sourceLabel:'Synthetic',sourceText:`SOURCE ${n}`,requestId:randomUUID()});
   const first=(await getStudioQuestion(db,reviewer.id,id))!;
   const v=await saveStudioDraft(db,reviewer.id,id,first.versionId,{stem:`Synthetic stem ${n}`,options:['A','B','C','D','E'],correctAnswer:1,explanation:'x',references:['ref']});
   // Versions are append-only; the trigger is paused only to give this synthetic draft an AI confidence.
   await db.exec('ALTER TABLE question_versions DISABLE TRIGGER version_append_only');
   await db.query('UPDATE question_versions SET confidence=$2,needs_expert=$3 WHERE id=$1',[v,confidence,needsExpert]);
   await db.exec('ALTER TABLE question_versions ENABLE TRIGGER version_append_only');
   if(submit)await reviewStudioQuestion(db,reviewer.id,id,v,'submit_review',false,'');
   return {id,versionId:v};
  };
  const high1=await make(1,92),high2=await make(2,80),low=await make(3,79),flagged=await make(4,95,true),unknown=await make(5,null),draft=await make(6,95,false,false);
  await assert.rejects(bulkApproveStudioQuestions(db,reviewer.id,[high1],false),/Confirm that you skimmed/);
  await assert.rejects(bulkApproveStudioQuestions(db,reviewer.id,[],true),/at least one/);
  await assert.rejects(bulkApproveStudioQuestions(db,reviewer.id,Array.from({length:BULK_APPROVE_MAX+1},()=>high1),true),/up to 25/);
  await assert.rejects(bulkApproveStudioQuestions(db,student.id,[high1],true),/permission/);
  const results=await bulkApproveStudioQuestions(db,reviewer.id,[high1,high2,low,flagged,unknown,draft],true);
  assert.deepEqual(results.map(r=>r.ok),[true,true,false,false,false,false]);
  assert.match(results[2].message!,/individual review/);assert.match(results[5].message!,/No longer waiting/);
  const status=async(id:string)=>(await db.query<{status:string}>('SELECT status FROM questions WHERE id=$1',[id]))[0].status;
  assert.equal(await status(high1.id),'approved');assert.equal(await status(high2.id),'approved');
  for(const q of [low,flagged,unknown])assert.equal(await status(q.id),'in_review');
  assert.equal((await db.query(`SELECT 1 FROM questions WHERE status='published'`)).length,0,'bulk approval never publishes');
  assert.equal((await db.query(`SELECT 1 FROM audit_log WHERE action='review.approve' AND entity_id=ANY($1::uuid[])`,[[high1.id,high2.id]])).length,2);
  // A second run is harmless: already-approved drafts are skipped, not changed.
  assert.equal((await bulkApproveStudioQuestions(db,reviewer.id,[high1],true))[0].ok,false);
 } finally {await db.close();}
});
