'use client';
import {useActionState} from 'react';
import {backfill,newConnection,removeConnection,retryEvent,saveConnection,testConnection,type GhlResult} from '@/app/studio/ghl-actions';
function Result({state}:{state:GhlResult}) {
 return state.error?<p className="studio-feedback studio-error" role="alert">{state.error}</p>:state.success?<p className="studio-feedback" role="status">{state.success}</p>:null;
}
export function NewConnectionForm({exams}:{exams:{id:string;name:string}[]}) {
 const[state,action,pending]=useActionState(newConnection,{});
 return <form action={action} className="students-form">
  <label className="studio-field">Connection name<input name="name" required minLength={2} maxLength={80} placeholder="For example, MEE main sub-account"/></label>
  <label className="studio-field">Location (sub-account) ID<input name="locationId" required pattern="[A-Za-z0-9]{6,64}" autoComplete="off"/></label>
  <label className="studio-field">Private integration token <span className="studio-help">stored encrypted, never shown again</span><input name="token" type="password" required minLength={20} maxLength={2000} autoComplete="off"/></label>
  <label className="studio-field">Exam <span className="studio-help">all exams, or one</span><select name="examId" defaultValue=""><option value="">All exams</option>{exams.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
  <Result state={state}/><button className="studio-button" disabled={pending}>{pending?'Saving…':'Add connection'}</button>
 </form>;
}
function Mini({action,id,label,confirm}:{action:typeof testConnection;id:string;label:string;confirm?:string}) {
 const[state,run,pending]=useActionState(action,{});
 return <form action={run} onSubmit={e=>{if(confirm&&!window.confirm(confirm))e.preventDefault();}}><input type="hidden" name="id" value={id}/><button className="studio-button studio-button-secondary" disabled={pending}>{pending?'Working…':label}</button><Result state={state}/></form>;
}
export const TestButton=(p:{id:string})=><Mini action={testConnection} id={p.id} label="Test connection"/>;
export const BackfillButton=(p:{id:string})=><Mini action={backfill} id={p.id} label="Backfill existing students" confirm="Send every existing active student to this GoHighLevel location? Confirm you have the right to do so."/>;
export const RemoveButton=(p:{id:string})=><Mini action={removeConnection} id={p.id} label="Remove" confirm="Remove this connection and its sync log? Contacts already in GoHighLevel are not deleted."/>;
export const RetryButton=(p:{id:string})=><Mini action={retryEvent} id={p.id} label="Retry"/>;
export function ConnectionForm({c,events,labels}:{c:{id:string;enabled:boolean;events:string[];tagMap:unknown;fieldMap:unknown;pipelineMap:unknown};events:string[];labels:Record<string,string>}) {
 const[state,action,pending]=useActionState(saveConnection,{});
 const pretty=(v:unknown)=>Object.keys(v as object).length?JSON.stringify(v,null,1):'';
 return <form action={action} className="students-form"><input type="hidden" name="id" value={c.id}/>
  <label className="studio-field"><span><input type="checkbox" name="enabled" defaultChecked={c.enabled}/> Syncing on</span></label>
  <fieldset className="studio-field"><legend>Events to send</legend>{events.map(e=><label key={e}><input type="checkbox" name={`event:${e}`} defaultChecked={c.events.includes(e)}/> {labels[e]}<br/></label>)}</fieldset>
  <label className="studio-field">Field mapping <span className="studio-help">JSON: our field name to a GoHighLevel custom field ID. Only mapped fields are sent.</span><textarea name="fieldMap" rows={4} defaultValue={pretty(c.fieldMap)} placeholder={'{"exam_part":"customFieldId","marketing_consent":"customFieldId"}'}/></label>
  <label className="studio-field">Tags <span className="studio-help">JSON: event to tag patterns. Empty keeps the defaults.</span><textarea name="tagMap" rows={3} defaultValue={pretty(c.tagMap)} placeholder={'{"purchase":["rt-paid-{exam}-{months}m"]}'}/></label>
  <label className="studio-field">Pipeline stages <span className="studio-help">JSON: event to pipeline, stage and status.</span><textarea name="pipelineMap" rows={3} defaultValue={pretty(c.pipelineMap)} placeholder={'{"purchase":{"pipelineId":"…","stageId":"…","status":"won"}}'}/></label>
  <label className="studio-field">Replace token <span className="studio-help">leave empty to keep the current one</span><input name="token" type="password" autoComplete="off" maxLength={2000}/></label>
  <Result state={state}/><button className="studio-button" disabled={pending}>{pending?'Saving…':'Save settings'}</button>
 </form>;
}
