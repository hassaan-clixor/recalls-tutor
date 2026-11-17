import type {Database} from '../db/client';
import {lockQuestionBank,requireId,requireStaff} from './studio';

export async function linkDuplicateEvidence(tx:Database,actorId:string,sourceId:string,targetId:string) {
 const [sourceRecord]=await tx.query<{id:string}>('SELECT id FROM recall_sources WHERE question_id=$1',[sourceId]);
 if(!sourceRecord)throw new Error('The original source evidence is missing.');
 await tx.query('UPDATE question_extra_evidence SET target_question_id=$1 WHERE target_question_id=$2',[targetId,sourceId]);
 await tx.query('UPDATE semantic_merge_evidence SET target_question_id=$1 WHERE target_question_id=$2',[targetId,sourceId]);
 await tx.query('INSERT INTO question_extra_evidence(target_question_id,source_question_id,source_id,decided_by) VALUES($1,$2,$3,$4)',[targetId,sourceId,sourceRecord.id,actorId]);
 await tx.query(`INSERT INTO question_sittings(question_id,sitting_id,exam_id,source_count) SELECT $1,sitting_id,exam_id,source_count FROM question_sittings WHERE question_id=$2 ON CONFLICT(question_id,sitting_id) DO NOTHING`,[targetId,sourceId]);
 await tx.query("UPDATE questions SET status='rejected' WHERE id=$1",[sourceId]);
}
/** Replacement creates a proposal; only a manager can accept and publish it. */
export async function resolveDuplicate(db:Database,actorId:string,input:{sourceId:string;sourceVersionId:string;targetId:string;targetVersionId:string;decision:'merge'|'keep_both'|'replace'}) {
 for(const id of [input.sourceId,input.sourceVersionId,input.targetId,input.targetVersionId])requireId(id);
 if(input.sourceId===input.targetId||!['merge','keep_both','replace'].includes(input.decision))throw new Error('Choose a valid duplicate decision.');
 return db.transaction(async tx=>{
  await requireStaff(tx,actorId);
  await lockQuestionBank(tx,input.sourceId);
  const rows=await tx.query<{id:string;exam_id:string;status:string;current_version_id:string}>(`SELECT id,exam_id,status,current_version_id FROM questions WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,[[input.sourceId,input.targetId]]);
  const source=rows.find(q=>q.id===input.sourceId),target=rows.find(q=>q.id===input.targetId);
  if(!source||!target||source.exam_id!==target.exam_id)throw new Error('Both questions must exist in the same exam.');
  if(source.current_version_id!==input.sourceVersionId||target.current_version_id!==input.targetVersionId)throw new Error('A question changed. Reload before deciding.');
  if(!['raw','ai_refined','in_review','approved'].includes(source.status)||(input.decision!=='keep_both'&&['rejected','retired'].includes(target.status)))throw new Error('This duplicate decision is no longer available.');
  const [version]=await tx.query<{duplicateOf:string|null}>(`SELECT ai_meta->>'duplicateOf' AS "duplicateOf" FROM question_versions WHERE id=$1 AND question_id=$2`,[input.sourceVersionId,input.sourceId]);
  if(version?.duplicateOf!==input.targetId)throw new Error('This question is no longer flagged as that match.');
  if((await tx.query('SELECT 1 FROM duplicate_decisions WHERE source_question_id=$1 AND source_version_id=$2',[input.sourceId,input.sourceVersionId])).length)throw new Error('This match has already been decided.');
  if(input.decision==='merge')await linkDuplicateEvidence(tx,actorId,input.sourceId,input.targetId);
  if(input.decision==='replace'){
   if(target.status!=='published')throw new Error('Replacement proposals require a published matching question. Edit unpublished drafts instead.');
   await tx.query(`INSERT INTO question_proposals(question_id,base_version_id,source,source_question_id,source_version_id,job_id,stem,options,correct_answers,explanation,references_json,key_notes,rationale,changes,confidence,model,created_by)
    SELECT $1,$2,'new_evidence',$3,$4,s.job_id,v.stem,v.options,v.correct_answers,v.explanation,v.references_json,v.key_notes,'Reviewer proposed replacing this question with the duplicate draft.','[]'::jsonb,v.confidence,v.ai_meta->>'model',$5 FROM question_versions v JOIN recall_sources s ON s.question_id=v.question_id WHERE v.id=$4 AND v.question_id=$3`,[input.targetId,input.targetVersionId,input.sourceId,input.sourceVersionId,actorId]);
  }
  await tx.query('INSERT INTO duplicate_decisions(source_question_id,source_version_id,target_question_id,target_version_id,decision,decided_by) VALUES($1,$2,$3,$4,$5,$6)',[input.sourceId,input.sourceVersionId,input.targetId,input.targetVersionId,input.decision,actorId]);
  await tx.query('INSERT INTO audit_log(actor_id,entity_id,action,after_json) VALUES($1,$2,$3,$4::jsonb)',[actorId,input.sourceId,'duplicate.resolved',JSON.stringify({...input})]);
 });
}
