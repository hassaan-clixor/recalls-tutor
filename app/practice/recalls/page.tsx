import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getCurrentActor} from '@/lib/auth/session';
import {SuspendedNotice} from '@/components/auth/suspended';
import {getDatabase} from '@/lib/db/client';
import {listPracticeExams} from '@/lib/services/practice';
import {listMyRecalls} from '@/lib/services/student-recalls';
import {StudentShell} from '@/components/practice/shell';
import {RecallForm} from '@/components/practice/recall-form';
export const metadata={title:'Share your recalls',robots:{index:false}};
export const dynamic='force-dynamic';
const LABEL:Record<string,string>={pending:'Waiting for review',accepted:'Accepted, thank you',declined:'Not used'};
export default async function RecallsPage() {
 const actor=await getCurrentActor();
 if(!actor)redirect('/sign-in?next=/practice/recalls');if(!actor.emailVerified)redirect('/verify-email');
 if(actor.suspended)return <SuspendedNotice/>;
 const db=getDatabase();
 const exams=await listPracticeExams(db,actor.id);const mine=await listMyRecalls(db,actor.id);
 const shellExams=exams.map(e=>({id:e.id,name:e.name,access:e.access}));
 return <StudentShell active="recalls" title="Share your recalls" actor={actor} exams={shellExams} examId={exams[0]?.id}><div className="app-column">
  <div className="app-title"><div><h1>Share your recalls</h1><p className="app-sub">Just sat your exam? Tell us what you remember. Accepted recalls become new practice questions.</p></div></div>
  {exams.length?<RecallForm exams={exams.map(e=>({id:e.id,name:e.name}))}/>:<div className="panel"><p>Recall sharing opens once you have access to an exam.</p><Link className="practice-button" href="/practice">Go to practice</Link></div>}
  {mine.length>0&&<section className="panel"><h2>Your submissions</h2><ul className="discussion-list">{mine.map(r=><li key={r.id}><p className="discussion-meta">{r.examName}{r.sittingHint?` · ${r.sittingHint}`:''} · {new Date(r.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} · {LABEL[r.status]??r.status}</p><p>{r.body}</p></li>)}</ul></section>}
 </div></StudentShell>;
}
