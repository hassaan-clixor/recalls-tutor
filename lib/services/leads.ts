import type {Database} from '../db/client';
import {requireStaff} from './studio';
// PRD 9.3: a visitor leaves an email on an exam page and gets pointed at the free trial. We store the consent as ticked.
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export async function saveLead(db:Database,input:{email:string;examSlug:string;consent:boolean}) {
 const email=input.email.trim().toLowerCase();
 if(!EMAIL.test(email)||email.length>254)throw new Error('Enter a valid email address.');
 if(!/^[a-z0-9-]{1,120}$/.test(input.examSlug))throw new Error('Unknown exam.');
 const [recent]=await db.query<{n:number}>(`SELECT count(*)::int AS n FROM leads WHERE created_at>now()-interval '1 minute'`);
 if(recent.n>=30)throw new Error('Too many sign-ups right now. Please try again shortly.');
 await db.query(`INSERT INTO leads(email,exam_slug,marketing_consent) VALUES($1,$2,$3) ON CONFLICT(email,exam_slug) DO UPDATE SET marketing_consent=leads.marketing_consent OR EXCLUDED.marketing_consent`,[email,input.examSlug,input.consent]);
}
export async function leadsCsv(db:Database,actorId:string) {
 await requireStaff(db,actorId,true);
 const rows=await db.query<{email:string;exam_slug:string;marketing_consent:boolean;created_at:string}>('SELECT email,exam_slug,marketing_consent,created_at::text FROM leads ORDER BY created_at DESC LIMIT 10000');
 const cell=(v:string)=>/^[=+\-@]/.test(v)?`'${v}`:v;
 return ['email,exam,marketing_consent,signed_up',...rows.map(r=>[cell(r.email),r.exam_slug,r.marketing_consent?'yes':'no',r.created_at].map(v=>`"${v.replace(/"/g,'""')}"`).join(','))].join('\n');
}
