import {validateSpreadsheetArchive} from './extract-text';
import {createHash,randomUUID} from 'node:crypto';
import type {Database} from '../db/client';
import {requireId,requireStaff,type DraftInput} from './studio';
import {configuredEmbeddings,cosineSimilarity,type EmbeddingModel} from '../integrations/llm/embeddings';

const COLUMNS=['stem','option_a','option_b','option_c','option_d','option_e','correct_answer','explanation','references'] as const;
export type ImportRow={row:number;draft:DraftInput};
export type ImportReport={rows:ImportRow[];errors:{row:number;message:string}[]};

// CSV supports quoted commas, escaped quotes and quoted line breaks. Reject malformed input rather than shifting answers.
function parseCsv(text:string):string[][] {
 const rows:string[][]=[];let row:string[]=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
  if(c==='"'){if(value||closed)throw new Error('Invalid CSV quoting.');quoted=true;continue;}
  if(c===','||c==='\n'||c==='\r'){
   row.push(value);value='';closed=false;
   if(c!==','){rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}
   continue;
  }
  if(closed)throw new Error('Invalid CSV quoting.');value+=c;
 }
 if(quoted)throw new Error('Unclosed quoted CSV field.');
 if(value||row.length||closed){row.push(value);rows.push(row);}
 return rows;
}
export async function readQuestionImport(name:string,bytes:Uint8Array):Promise<ImportReport> {
 if(bytes.length>4*1024*1024)throw new Error('The file must be 4 MB or smaller.');
 let table:string[][];
 if(/\.csv$/i.test(name))table=parseCsv(new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,''));
 else if(/\.xlsx$/i.test(name)){
  validateSpreadsheetArchive(bytes);
  const ExcelJS=(await import('exceljs')).default,book=new ExcelJS.Workbook();
  try{await book.xlsx.load(Buffer.from(bytes) as never);}catch{throw new Error('The spreadsheet could not be read.');}
  if(book.worksheets.length!==1)throw new Error('Use a workbook with exactly one worksheet.');
  const sheet=book.worksheets[0];if(sheet.rowCount>1001||sheet.columnCount>50)throw new Error('The template supports up to 1,000 rows and 50 columns.');
  table=[];sheet.eachRow({includeEmpty:true},row=>{const values:string[]=[];row.eachCell({includeEmpty:true},(cell,column)=>{
   const v=cell.value;if(v!==null&&typeof v==='object')throw new Error('Template cells must contain plain text or numbers, not formulas or other objects.');
   values[column-1]=v==null?'':String(v);
  });table.push(values);});
 } else throw new Error('Upload a CSV or XLSX template.');
 if(table.length>1001)throw new Error('The template supports up to 1,000 rows.');
 const header=(table.shift()??[]).map(value=>(value??'').trim().toLowerCase());
 if(new Set(header).size!==header.length||COLUMNS.some(column=>!header.includes(column))||header.some(column=>!COLUMNS.includes(column as typeof COLUMNS[number])))throw new Error(`Template headers must contain exactly: ${COLUMNS.join(', ')}.`);
 const rows:ImportRow[]=[],errors:ImportReport['errors']=[];
 for(let i=0;i<table.length;i++){
  const values=table[i];if(values.every(v=>!v?.trim()))continue;
  const get=(column:typeof COLUMNS[number])=>(values[header.indexOf(column)]??'').trim();
  if(values.slice(header.length).some(v=>v?.trim())){errors.push({row:i+2,message:'Unexpected extra cells.'});continue;}
  const options=COLUMNS.slice(1,6).map(column=>get(column)),answer=get('correct_answer').toUpperCase(),references=get('references').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  const draft:DraftInput={stem:get('stem'),options,correctAnswer:'ABCDE'.indexOf(answer),explanation:get('explanation'),references};
  const problems:string[]=[];
  if(!draft.stem||options.some(v=>!v)||!draft.explanation||!references.length)problems.push('Complete the stem, five options, explanation and references.');
  if(!/^[A-E]$/.test(answer))problems.push('Correct answer must be A, B, C, D or E.');
  if(new Set(options.map(v=>v.toLowerCase())).size!==5)problems.push('Answer options must be distinct.');
  if(draft.stem.length>12000||draft.explanation.length>20000||options.some(v=>v.length>3000)||references.length>20||references.some(v=>v.length>2000))problems.push('One or more fields exceed the allowed length.');
  if(problems.length)errors.push({row:i+2,message:problems.join(' ')});else rows.push({row:i+2,draft});
 }
 if(!rows.length&&!errors.length)throw new Error('The template has no question rows.');
 return {rows,errors};
}

/** An import is all-or-nothing and creates only private drafts, never approved or published questions. */
export async function importCleanQuestions(db:Database,actorId:string,input:{examId:string;requestId:string;sourceLabel:string;name:string;bytes:Uint8Array},embeddingOverride?:EmbeddingModel|null) {
 requireId(input.examId);requireId(input.requestId);
 const label=input.sourceLabel.trim();if(!label||label.length>200)throw new Error('Provide a source label of up to 200 characters.');
 await requireStaff(db,actorId,true);
 const report=await readQuestionImport(input.name,input.bytes);
 if(report.errors.length)return {errors:report.errors,questionIds:[] as string[]};
 const fingerprint=createHash('sha256').update(JSON.stringify([input.examId,label,input.name])).update(input.bytes).digest('hex');
 const [prior]=await db.query<{fingerprint:string;question_ids:string[]}>('SELECT fingerprint,question_ids FROM question_imports WHERE actor_id=$1 AND request_id=$2',[actorId,input.requestId]);
 if(prior){if(prior.fingerprint!==fingerprint)throw new Error('This request was already used for a different import.');return {errors:[],questionIds:prior.question_ids};}
 const bank=await db.query<{id:string;version:string;status:string;stem:string}>(`SELECT q.id,v.id AS version,q.status,v.stem FROM questions q JOIN question_versions v ON v.id=q.current_version_id WHERE q.exam_id=$1 AND q.status<>'rejected' AND v.stem<>'' ORDER BY q.id`,[input.examId]);
 const snapshot=bank.map(q=>`${q.id}:${q.version}:${q.status}`).join(',');
 const embedder=embeddingOverride===undefined?configuredEmbeddings():embeddingOverride;
 const vectors=embedder?await embedder.embed([...bank.map(q=>q.stem),...report.rows.map(r=>r.draft.stem)]):null;
 if(vectors&&vectors.length!==bank.length+report.rows.length)throw new Error('Semantic comparison did not cover the full question bank.');
 const result=await db.transaction(async tx=>{
  await requireStaff(tx,actorId,true);
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[actorId+input.requestId]);
  const [existing]=await tx.query<{fingerprint:string;question_ids:string[]}>('SELECT fingerprint,question_ids FROM question_imports WHERE actor_id=$1 AND request_id=$2',[actorId,input.requestId]);
  if(existing){if(existing.fingerprint!==fingerprint)throw new Error('This request was already used for a different import.');return {errors:[],questionIds:existing.question_ids};}
  if(!(await tx.query('SELECT id FROM exams WHERE id=$1',[input.examId])).length)throw new Error('Exam not found.');
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`studio-dedupe:${input.examId}`]);
  const current=await tx.query<{id:string;version:string;status:string}>(`SELECT q.id,v.id AS version,q.status FROM questions q JOIN question_versions v ON v.id=q.current_version_id WHERE q.exam_id=$1 AND q.status<>'rejected' AND v.stem<>'' ORDER BY q.id FOR SHARE OF q`,[input.examId]);
  if(current.map(q=>`${q.id}:${q.version}:${q.status}`).join(',')!==snapshot)throw new Error('The question bank changed during duplicate checking. Retry the import.');
  const errors:ImportReport['errors']=[];
  const normalized=(text:string)=>text.trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
  for(const [i,item] of report.rows.entries()){
   const stem=normalized(item.draft.stem),vector=vectors?.[bank.length+i];
   const existingMatch=bank.findIndex((q,j)=>q.status!=='retired'&&(stem===normalized(q.stem)||!!(vector&&vectors&&cosineSimilarity(vector,vectors[j])>=0.8)));
   const earlierMatch=report.rows.slice(0,i).findIndex((other,j)=>stem===normalized(other.draft.stem)||!!(vector&&vectors&&cosineSimilarity(vector,vectors[bank.length+j])>=0.8));
   if(existingMatch>=0)errors.push({row:item.row,message:`Possible duplicate of existing question ${bank[existingMatch].id}. Compare it in the question workspace before importing.`});
   else if(earlierMatch>=0)errors.push({row:item.row,message:`Possible duplicate of row ${report.rows[earlierMatch].row}. Compare the rows before importing.`});
  }
  if(errors.length)return {errors,questionIds:[] as string[]};
  const ids:string[]=[];
  for(const {row,draft} of report.rows){
   const [question]=await tx.query<{id:string}>('INSERT INTO questions(exam_id) VALUES($1) RETURNING id',[input.examId]);
   const [version]=await tx.query<{id:string}>(`INSERT INTO question_versions(question_id,version,stem,options,correct_answers,explanation,references_json) VALUES($1,1,$2,$3::jsonb,$4::jsonb,$5,$6::jsonb) RETURNING id`,[question.id,draft.stem,JSON.stringify(draft.options),JSON.stringify([draft.correctAnswer]),draft.explanation,JSON.stringify(draft.references)]);
   await tx.query('UPDATE questions SET current_version_id=$1 WHERE id=$2',[version.id,question.id]);
   await tx.query('INSERT INTO recall_sources(question_id,source_text,source_label,created_by,request_id) VALUES($1,$2,$3,$4,$5)',[question.id,draft.stem,label,actorId,randomUUID()]);
   await tx.query('INSERT INTO audit_log(actor_id,entity_id,action,after_json) VALUES($1,$2,$3,$4::jsonb)',[actorId,question.id,'question.imported',JSON.stringify({versionId:version.id,row,sourceLabel:label,status:'raw'})]);
   ids.push(question.id);
  }
  await tx.query('INSERT INTO question_imports(actor_id,request_id,fingerprint,question_ids) VALUES($1,$2,$3,$4::jsonb)',[actorId,input.requestId,fingerprint,JSON.stringify(ids)]);
  return {errors:[],questionIds:ids};
 });
 return result;
}
