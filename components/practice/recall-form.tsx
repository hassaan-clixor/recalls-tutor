'use client';
import {useActionState} from 'react';
import {sendRecall,type PracticeResult} from '@/app/practice/actions';

export function RecallForm({exams}:{exams:{id:string;name:string}[]}){
 const[state,action,pending]=useActionState<PracticeResult,FormData>(sendRecall,{});
 return <form action={action} className="panel recall-form">
  <label className="studio-field">Exam<select name="examId" required>{exams.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
  <label className="studio-field">Sitting <small>(optional, for example “March 2026”)</small><input name="sittingHint" maxLength={80}/></label>
  <label className="studio-field">What do you remember?<textarea name="body" required rows={8} minLength={20} maxLength={8000} placeholder="Describe the questions or topics you remember: the scenario, the options if you recall them, and the answer you think is right."/></label>
  <p className="app-sub">Please do not include your name or contact details. We remove common identifiers, but check what you send.</p>
  {state.error&&<p className="practice-error" role="alert">{state.error}</p>}{state.success&&<p className="practice-help" role="status">{state.success}</p>}
  <button className="practice-button" disabled={pending}>{pending?'Sending…':'Send my recall'}</button>
 </form>;
}
