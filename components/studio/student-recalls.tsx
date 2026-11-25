'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {decideRecall} from '@/app/studio/actions';
import type {StudentRecall} from '@/lib/services/student-recalls';
// PRD 6.9: recalls students send in wait here. Accepting one adds it to the question queue as a recall to draft from.
export function StudentRecallQueue({recalls,manager}:{recalls:StudentRecall[];manager:boolean}){
 const router=useRouter();const[busy,start]=useTransition();const[error,setError]=useState('');
 if(!recalls.length)return <p className="studio-help">No student recalls waiting.</p>;
 const go=(id:string,ok:boolean)=>start(async()=>{const r=await decideRecall(id,ok);if(r.error)setError(r.error);else{setError('');router.refresh();}});
 return <><ul className="studio-jobs studio-reports">{recalls.map(r=><li key={r.id} className="studio-job">
  <span className="studio-report-details">{r.body}</span>
  <span>{r.examName}{r.sittingHint?` · ${r.sittingHint}`:''} · {new Date(r.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
  {manager&&<span className="studio-report-actions"><button type="button" className="studio-button studio-button-secondary studio-button-small" disabled={busy} onClick={()=>go(r.id,true)}>Accept as recall</button><button type="button" className="studio-button studio-button-secondary studio-button-small" disabled={busy} onClick={()=>go(r.id,false)}>Decline</button></span>}
 </li>)}</ul>{error&&<p className="studio-feedback" role="alert">{error}</p>}</>;
}
