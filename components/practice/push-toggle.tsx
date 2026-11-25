'use client';
import {useEffect,useState} from 'react';
import {subscribePush,unsubscribePush} from '@/app/account/actions';

const b64=(s:string)=>{const p='='.repeat((4-s.length%4)%4),raw=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));};
// PRD 6.8: an opt-in reminder when reviews are due. Asks the browser for permission only after the student clicks.
export function PushToggle({publicKey}:{publicKey:string|null}){
 const[state,setState]=useState<'unsupported'|'off'|'on'|'blocked'>('unsupported');const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 useEffect(()=>{(async()=>{
  if(!publicKey||!('serviceWorker' in navigator)||!('PushManager' in window)){return;}
  if(Notification.permission==='denied'){setState('blocked');return;}
  const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager.getSubscription();setState(sub?'on':'off');
 })().catch(()=>{});},[publicKey]);
 if(state==='unsupported')return <p className="app-sub">Review reminders are not available in this browser.</p>;
 const turnOn=async()=>{setBusy(true);setError('');try{
  const reg=await navigator.serviceWorker.ready;
  if(await Notification.requestPermission()!=='granted'){setState('blocked');return;}
  const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(publicKey!)});
  const r=await subscribePush(sub.endpoint);if(r.error){setError(r.error);await sub.unsubscribe();}else setState('on');
 }catch{setError('Could not turn reminders on in this browser.');}finally{setBusy(false);}};
 const turnOff=async()=>{setBusy(true);try{const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager.getSubscription();if(sub){await unsubscribePush(sub.endpoint);await sub.unsubscribe();}setState('off');}finally{setBusy(false);}};
 return <div><p>Get a daily reminder when you have questions due for review.</p>
  {state==='blocked'?<p className="app-sub">Notifications are blocked for this site. Allow them in your browser settings to turn reminders on.</p>
   :state==='on'?<button type="button" className="practice-ghost" disabled={busy} onClick={turnOff}>Turn reminders off</button>
   :<button type="button" className="practice-button" disabled={busy} onClick={turnOn}>Turn reminders on</button>}
  {error&&<p className="practice-error" role="alert">{error}</p>}</div>;
}
