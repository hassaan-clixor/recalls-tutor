import type {Database} from '../db/client';
import {dueReviewIds} from './review';

export type Flashcard={id:string;topic:string;front:string;back:string;source:'note'|'key point'};
// STU-12: flashcards are built from what the student already owns. Their own notes and the teaching points of the
// questions they are due to review. Question stems and options are never used, so the question bank stays protected (PROT-4).
export async function flashcardsFor(db:Database,userId:string,examId:string,limit=40):Promise<Flashcard[]> {
 const notes=await db.query<{id:string;topic:string|null;body:string}>(`SELECT n.id::text AS id,COALESCE(p.name,t.name) AS topic,n.body FROM question_notes n JOIN questions q ON q.id=n.question_id LEFT JOIN topics t ON t.id=q.topic_id LEFT JOIN topics p ON p.id=t.parent_id WHERE n.user_id=$1 AND q.exam_id=$2 ORDER BY n.updated_at DESC LIMIT $3`,[userId,examId,limit]);
 const cards:Flashcard[]=notes.map(n=>({id:`n-${n.id}`,topic:n.topic??'General',front:`Your note in ${n.topic??'General'}. What do you remember about it?`,back:n.body,source:'note'}));
 const due=(await dueReviewIds(db,userId,examId)).slice(0,limit);
 if(due.length){
  const rows=await db.query<{id:string;topic:string|null;notes:unknown}>(`SELECT q.id::text AS id,COALESCE(p.name,t.name) AS topic,v.key_notes AS notes FROM questions q JOIN question_versions v ON v.id=q.current_version_id LEFT JOIN topics t ON t.id=q.topic_id LEFT JOIN topics p ON p.id=t.parent_id WHERE q.id::text=ANY($1::text[]) AND q.status='published'`,[due]);
  for(const r of rows){const points=Array.isArray(r.notes)?(r.notes as unknown[]).filter((x):x is string=>typeof x==='string'&&x.trim().length>0):[];
   points.slice(0,2).forEach((p,i)=>cards.push({id:`k-${r.id}-${i}`,topic:r.topic??'General',front:`${r.topic??'General'}: a key point from a question you are due to review.`,back:p,source:'key point'}));}
 }
 return cards.slice(0,limit);
}
