import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getCurrentActor} from '@/lib/auth/session';
import {SuspendedNotice} from '@/components/auth/suspended';
import {getDatabase} from '@/lib/db/client';
import {listPracticeExams} from '@/lib/services/practice';
import {flashcardsFor} from '@/lib/services/flashcards';
import {StudentShell} from '@/components/practice/shell';
import {FlashcardDeck} from '@/components/practice/flashcards';
export const metadata={title:'Flashcards',robots:{index:false}};
export const dynamic='force-dynamic';
export default async function FlashcardsPage(props:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const actor=await getCurrentActor();
 if(!actor)redirect('/sign-in?next=/practice/flashcards');if(!actor.emailVerified)redirect('/verify-email');
 if(actor.suspended)return <SuspendedNotice/>;
 const db=getDatabase();const query=await props.searchParams;
 const exams=await listPracticeExams(db,actor.id);
 const exam=exams.find(e=>e.id===query.exam)??exams[0];
 if(!exam)return <StudentShell active="flashcards" title="Flashcards" actor={actor}><div className="app-column"><div className="app-title"><div><h1>Flashcards</h1><p className="app-sub">Your cards appear once you have access to an exam.</p></div></div><Link className="practice-button" href="/practice">Go to practice</Link></div></StudentShell>;
 const cards=await flashcardsFor(db,actor.id,exam.id);
 const shellExams=exams.map(e=>({id:e.id,name:e.name,access:e.access}));
 return <StudentShell active="flashcards" title="Flashcards" actor={actor} exams={shellExams} examId={exam.id}><div className="app-column">
  <div className="app-title"><div><h1>Flashcards for {exam.name}</h1><p className="app-sub">Built from your own notes and the key points of questions that are due for review.</p></div></div>
  {cards.length?<FlashcardDeck cards={cards}/>:<div className="panel"><p>No cards yet. Add a note to a question, or answer questions wrongly or with low confidence, and cards appear here.</p><Link className="practice-button" href="/practice">Start practising</Link></div>}
 </div></StudentShell>;
}
