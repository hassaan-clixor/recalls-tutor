import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Workbook} from 'exceljs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {embeddedDatabase} from '../lib/db/client';
import {migrate} from '../lib/db/migrate';
import {seedCatalogue} from '../lib/db/seed';
import {listExams} from '../lib/services/catalogue';
import {getStudioQuestion,reviewStudioQuestion,saveStudioDraft} from '../lib/services/studio';
import {importCleanQuestions,readQuestionImport} from '../lib/services/question-import';

const header='stem,option_a,option_b,option_c,option_d,option_e,correct_answer,explanation,references';
const row='"Stem, with comma",one,two,three,four,five,B,Explanation,"Reference one\nReference two"';
test('clean question CSV preserves quoted content and reports invalid rows',async()=>{
 const result=await readQuestionImport('questions.csv',new TextEncoder().encode(`${header}\n${row}\nBad,one,one,three,four,five,Z,,`));
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].draft.stem,'Stem, with comma');
 assert.equal(result.rows[0].draft.correctAnswer,1);assert.deepEqual(result.rows[0].draft.references,['Reference one','Reference two']);
 assert.equal(result.errors[0].row,3);assert.match(result.errors[0].message,/Correct answer/);
 await assert.rejects(readQuestionImport('bad.csv',new TextEncoder().encode(`${header}\n"unterminated`)),/Unclosed/);
});
test('clean question XLSX validates headers and rejects formulas',async()=>{
 const book=new Workbook(),sheet=book.addWorksheet('Questions');sheet.addRow(header.split(','));sheet.addRow(['A question','one','two','three','four','five','A','Explanation','Reference']);
 const result=await readQuestionImport('questions.xlsx',new Uint8Array(await book.xlsx.writeBuffer()));assert.equal(result.rows.length,1);
 sheet.getCell('A2').value={formula:'1+1',result:2};
 await assert.rejects(readQuestionImport('questions.xlsx',new Uint8Array(await book.xlsx.writeBuffer())),/plain text/);
});
test('clean import is manager-only, atomic, idempotent and requires human publication',async()=>{
 const db=embeddedDatabase(new PGlite());
 try {
  await migrate(db);await seedCatalogue(db);
  async function actor(role:string){const id=randomUUID();await db.query('INSERT INTO auth_users(id,name,email,email_verified,created_at,updated_at) VALUES($1,$2,$3,true,now(),now())',[id,role,`${id}@example.test`]);return (await db.query<{id:string}>('INSERT INTO app_users(auth_id,role) VALUES($1,$2) RETURNING id',[id,role]))[0].id;}
  const manager=await actor('content_manager'),reviewer=await actor('reviewer'),exam=(await listExams(db))[0];
  const input={examId:exam.id,requestId:randomUUID(),sourceLabel:'Synthetic import',name:'questions.csv',bytes:new TextEncoder().encode(`${header}\n${row}`)};
  await assert.rejects(importCleanQuestions(db,reviewer,input),/permission/);
  const invalid=await importCleanQuestions(db,manager,{...input,bytes:new TextEncoder().encode(`${header}\n${row}\nBad,one,one,three,four,five,Z,,`)});
  assert.equal(invalid.errors.length,1);assert.equal((await db.query('SELECT id FROM questions')).length,0);
  const first=await importCleanQuestions(db,manager,input),again=await importCleanQuestions(db,manager,input);assert.deepEqual(again.questionIds,first.questionIds);
  await assert.rejects(importCleanQuestions(db,manager,{...input,sourceLabel:'Changed'}),/already used/);
  const question=await getStudioQuestion(db,reviewer,first.questionIds[0]);assert.ok(question);assert.equal(question.status,'raw');
  const exact=await importCleanQuestions(db,manager,{...input,requestId:randomUUID()},null);assert.match(exact.errors[0].message,/existing question/);
  const semantic=await importCleanQuestions(db,manager,{...input,requestId:randomUUID(),bytes:new TextEncoder().encode(`${header}\nDifferent wording,one,two,three,four,five,A,Explanation,Reference`)},{name:'test',async embed(texts){return texts.map(()=>[1,0]);}});
  assert.match(semantic.errors[0].message,/existing question/);
  const batch=await importCleanQuestions(db,manager,{...input,requestId:randomUUID(),bytes:new TextEncoder().encode(`${header}\nFirst wording,one,two,three,four,five,A,Explanation,Reference\nSecond wording,one,two,three,four,five,A,Explanation,Reference`)},{name:'test',async embed(texts){return texts.map((_,i)=>i===0?[0,1]:[1,0]);}});
  assert.match(batch.errors[0].message,/row 2/);
  await assert.rejects(importCleanQuestions(db,manager,{...input,requestId:randomUUID(),bytes:new TextEncoder().encode(`${header}\nNew wording,one,two,three,four,five,A,Explanation,Reference`)},{name:'concurrent-edit',async embed(texts){
   await saveStudioDraft(db,reviewer,question.id,question.versionId,{stem:'Changed while comparing',options:question.options,correctAnswer:question.correctAnswer,explanation:question.explanation,references:question.references});
   return texts.map(()=>[1,0]);
  }}),/bank changed/);
  const changed=await getStudioQuestion(db,reviewer,question.id);assert.ok(changed);
  await assert.rejects(reviewStudioQuestion(db,manager,changed.id,changed.versionId,'publish',false,''),/not available/);
  assert.equal((await db.query("SELECT id FROM audit_log WHERE action='question.imported'")).length,1);
 }finally{await db.close();}
});
