import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {embeddedDatabase} from '../lib/db/client';
import {migrate} from '../lib/db/migrate';
import {seedCatalogue} from '../lib/db/seed';
import {listExams} from '../lib/services/catalogue';
import {createRecall,getStudioQuestion,saveStudioDraft,reviewStudioQuestion} from '../lib/services/studio';
import {flashcardsFor} from '../lib/services/flashcards';

test('Flashcards come from the student’s own notes, never from question text',async()=>{
 const db=embeddedDatabase(new PGlite());
 try {
  await migrate(db);await seedCatalogue(db);
  async function actor(role:string,twoFactor=false) {const authId=randomUUID(),email=`${authId}@example.test`;await db.query('INSERT INTO auth_users(id,name,email,email_verified,two_factor_enabled,created_at,updated_at) VALUES($1,$2,$3,true,$4,now(),now())',[authId,'Sam',email,twoFactor]);return (await db.query<{id:string}>('INSERT INTO app_users(auth_id,role) VALUES($1,$2) RETURNING id',[authId,role]))[0].id;}
  const manager=await actor('content_manager'),student=await actor('student'),other=await actor('student');
  const exam=(await listExams(db)).find(e=>e.slug==='mrcog-part-1')!;
  assert.deepEqual(await flashcardsFor(db,student,exam.id),[]);
  const id=await createRecall(db,manager,{examId:exam.id,sourceLabel:'Synthetic',sourceText:'SOURCE',requestId:randomUUID()});
  const first=(await getStudioQuestion(db,manager,id))!;
  const v=await saveStudioDraft(db,manager,id,first.versionId,{stem:'SECRET STEM TEXT',options:['A','B','C','D','E'],correctAnswer:1,explanation:'Because R.',references:['ref'],keyNotes:['Key point']});
  await reviewStudioQuestion(db,manager,id,v,'submit_review',false,'');await reviewStudioQuestion(db,manager,id,v,'approve',true,'');await reviewStudioQuestion(db,manager,id,v,'publish',false,'');
  await db.query('INSERT INTO question_notes(user_id,question_id,body) VALUES($1,$2,$3)',[student,id,'Remember the river mnemonic']);
  const cards=await flashcardsFor(db,student,exam.id);
  assert.equal(cards.length,1);assert.equal(cards[0].back,'Remember the river mnemonic');assert.equal(cards[0].source,'note');
  assert.ok(!JSON.stringify(cards).includes('SECRET STEM TEXT'));
  assert.deepEqual(await flashcardsFor(db,other,exam.id),[]);// another student's notes are never shown
 } finally {await db.close();}
});
