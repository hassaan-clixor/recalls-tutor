import type {Database} from '../db/client';
import {requireId,requireStaff,createRecall} from './studio';
import {sanitizeRecallText} from './ai-studio';

// PRD 6.9: a student can send in what they remember from their exam. Staff accept it (it becomes a recall in the
// Studio queue, with the student credited) or decline it. Contact details are stripped before storing.
const DAILY_LIMIT=3;
export type StudentRecall={id:string;examName:string;sittingHint:string|null;body:string;status:string;createdAt:string};
export async function submitStudentRecall(db:Database,userId:string,input:{examId:string;sittingHint:string;body:string}) {
 requireId(input.examId);
 const body=sanitizeRecallText(input.body.trim()).text;
 if(body.length<20)throw new Error('Write at least a couple of sentences about what you remember.');
 if(body.length>8000)throw new Error('Keep a single submission under 8,000 characters.');
 const hint=input.sittingHint.trim().slice(0,80)||null;
 const [access]=await db.query('SELECT 1 FROM exams WHERE id=$1',[input.examId]);
 if(!access)throw new Error('Choose an exam.');
 const [{n}]=await db.query<{n:number}>(`SELECT count(*)::int AS n FROM student_recalls WHERE user_id=$1 AND created_at>now()-interval '1 day'`,[userId]);
 if(n>=DAILY_LIMIT)throw new Error('You have sent the most recalls allowed today. Thank you, please try again tomorrow.');
 const [row]=await db.query<{id:string}>('INSERT INTO student_recalls(user_id,exam_id,sitting_hint,body) VALUES($1,$2,$3,$4) RETURNING id',[userId,input.examId,hint,body]);
 return row.id;
}
export async function listMyRecalls(db:Database,userId:string):Promise<StudentRecall[]> {
 return db.query<StudentRecall>(`SELECT r.id,e.name AS "examName",r.sitting_hint AS "sittingHint",left(r.body,300) AS body,r.status,r.created_at::text AS "createdAt" FROM student_recalls r JOIN exams e ON e.id=r.exam_id WHERE r.user_id=$1 ORDER BY r.created_at DESC LIMIT 30`,[userId]);
}
export async function listPendingStudentRecalls(db:Database,actorId:string):Promise<StudentRecall[]> {
 await requireStaff(db,actorId);
 return db.query<StudentRecall>(`SELECT r.id,e.name AS "examName",r.sitting_hint AS "sittingHint",r.body,r.status,r.created_at::text AS "createdAt" FROM student_recalls r JOIN exams e ON e.id=r.exam_id WHERE r.status='pending' ORDER BY r.created_at LIMIT 50`);
}
export async function decideStudentRecall(db:Database,actorId:string,id:string,accept:boolean) {
 requireId(id);await requireStaff(db,actorId,true);
 // The update claims the row, so two staff members cannot both accept it. If adding it to the queue fails, the claim is undone.
 const [r]=await db.query<{exam_id:string;body:string;hint:string|null}>(`UPDATE student_recalls SET status=$2,reviewed_by=$3,reviewed_at=now(),credited=$4 WHERE id=$1 AND status='pending' RETURNING exam_id,body,sitting_hint AS hint`,[id,accept?'accepted':'declined',actorId,accept]);
 if(!r)throw new Error('This recall has already been reviewed.');
 if(accept){
  try{await createRecall(db,actorId,{examId:r.exam_id,sourceLabel:`Student recall${r.hint?` (${r.hint})`:''}`,sourceText:r.body,requestId:id});}
  catch(error){await db.query(`UPDATE student_recalls SET status='pending',reviewed_by=NULL,reviewed_at=NULL,credited=false WHERE id=$1`,[id]);throw error;}
 }
}
