import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {embeddedDatabase} from '../lib/db/client';
import {migrate} from '../lib/db/migrate';
import {seedCatalogue} from '../lib/db/seed';
import {createRecall,getStudioQuestion,saveStudioDraft,reviewStudioQuestion} from '../lib/services/studio';
import {updateExamSettings} from '../lib/services/catalogue-admin';
import {listExams} from '../lib/services/catalogue';
import {submitStudentRecall,listMyRecalls,listPendingStudentRecalls,decideStudentRecall} from '../lib/services/student-recalls';

test('Two-step approval, student recalls and best-answer marking',async()=>{
 const db=embeddedDatabase(new PGlite());
 try {
  await migrate(db);await seedCatalogue(db);
  async function actor(role:string,twoFactor=false) {const authId=randomUUID(),email=`${authId}@example.test`;await db.query('INSERT INTO auth_users(id,name,email,email_verified,two_factor_enabled,created_at,updated_at) VALUES($1,$2,$3,true,$4,now(),now())',[authId,'Sam',email,twoFactor]);return {id:(await db.query<{id:string}>('INSERT INTO app_users(auth_id,role) VALUES($1,$2) RETURNING id',[authId,role]))[0].id,email};}
  const admin=await actor('super_admin',true),manager=await actor('content_manager'),reviewer=await actor('reviewer'),student=await actor('student');
  const exam=(await listExams(db)).find(e=>e.slug==='mrcog-part-1')!;
  async function draft(n:number) {
   const id=await createRecall(db,manager.id,{examId:exam.id,sourceLabel:'Synthetic',sourceText:`SOURCE ${n}`,requestId:randomUUID()});
   const first=(await getStudioQuestion(db,reviewer.id,id))!;
   const v=await saveStudioDraft(db,reviewer.id,id,first.versionId,{stem:`Synthetic stem ${n}`,options:['A','B','C','D','E'],correctAnswer:1,explanation:'Approved explanation: B because of reason R.',references:['ref'],keyNotes:['Approved note']});
   await reviewStudioQuestion(db,reviewer.id,id,v,'submit_review',false,'');
   return {id,v};
  }
  const status=async(id:string)=>(await db.query<{status:string}>('SELECT status FROM questions WHERE id=$1',[id]))[0].status;
  // Off by default: a Reviewer approves directly.
  const a=await draft(1);await reviewStudioQuestion(db,reviewer.id,a.id,a.v,'approve',true,'');assert.equal(await status(a.id),'approved');
  // On: a Reviewer only recommends; a Content Manager then approves.
  await updateExamSettings(db,admin.id,exam.id,{questionCount:'',durationMinutes:'',passMarkPercent:'',highYieldMin:'',needsExpertBelow:'',approvedSources:[],styleNotes:'',twoStepApproval:true});
  const b=await draft(2);
  await assert.rejects(reviewStudioQuestion(db,manager.id,b.id,b.v,'approve',true,''),/Reviewer sign-off/);
  await reviewStudioQuestion(db,reviewer.id,b.id,b.v,'approve',true,'Looks right');assert.equal(await status(b.id),'in_review');
  await reviewStudioQuestion(db,manager.id,b.id,b.v,'approve',true,'');assert.equal(await status(b.id),'approved');
  // Student recalls: validated, limited per day, staff accept into the queue.
  await assert.rejects(submitStudentRecall(db,student.id,{examId:exam.id,sittingHint:'',body:'too short'}),/couple of sentences/);
  const r=await submitStudentRecall(db,student.id,{examId:exam.id,sittingHint:'March 2026',body:'A woman at 32 weeks with itching worse at night and raised bile acids. What is the next step?'});
  assert.equal((await listMyRecalls(db,student.id))[0].status,'pending');
  await assert.rejects(decideStudentRecall(db,reviewer.id,r,true),/permission/);
  assert.equal((await listPendingStudentRecalls(db,reviewer.id)).length,1);
  const before=(await db.query('SELECT 1 FROM recall_sources')).length;
  await decideStudentRecall(db,manager.id,r,true);
  assert.equal((await db.query('SELECT 1 FROM recall_sources')).length,before+1);
  assert.equal((await listMyRecalls(db,student.id))[0].status,'accepted');
  await assert.rejects(decideStudentRecall(db,manager.id,r,false),/already been reviewed/);
  await submitStudentRecall(db,student.id,{examId:exam.id,sittingHint:'',body:'Another recall with enough words to be accepted by the form.'});
  await submitStudentRecall(db,student.id,{examId:exam.id,sittingHint:'',body:'A third recall with enough words to be accepted by the form.'});
  await assert.rejects(submitStudentRecall(db,student.id,{examId:exam.id,sittingHint:'',body:'A fourth recall with enough words to be accepted by the form.'}),/most recalls allowed today/);
 } finally {await db.close();}
});
