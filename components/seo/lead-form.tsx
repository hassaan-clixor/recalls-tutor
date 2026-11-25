'use client';
import {useActionState} from 'react';
import {joinList,type LeadResult} from '@/app/leads/actions';
export function LeadForm({examSlug,examName}:{examSlug:string;examName:string}){
 const[state,action,pending]=useActionState<LeadResult,FormData>(joinList,{});
 return <form action={action} className="lead-form">
  <input type="hidden" name="examSlug" value={examSlug}/>
  <label className="lead-trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
  <label>Email address<input name="email" type="email" required autoComplete="email" maxLength={254}/></label>
  <label className="lead-consent"><input type="checkbox" name="consent" value="yes"/>Send me study tips and updates about {examName}. I can unsubscribe at any time.</label>
  {state.error&&<p role="alert" className="lead-error">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
  <button className="hb-btn primary" disabled={pending}>{pending?'Saving…':'Keep me posted'}</button>
 </form>;
}
