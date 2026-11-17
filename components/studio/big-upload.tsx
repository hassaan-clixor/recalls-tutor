'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {beginBigUpload,confirmBigUpload,finishBigUpload,retryBigUpload} from '@/app/studio/upload-actions';
import type {BatchProgress} from '@/lib/services/upload-batches';
type Row={name:string;size:number;state:'waiting'|'uploading'|'done'|'failed';percent:number;error?:string};
const mb=(n:number)=>`${(n/1048576).toFixed(n<10485760?1:0)} MB`;
// Sends each file straight to storage with a signed URL (three at a time, three tries each), then tells the server.
function put(url:string,file:File,onProgress:(p:number)=>void):Promise<void> {
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('PUT',url);
  xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
  xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error(`Storage answered ${xhr.status}.`));
  xhr.onerror=()=>reject(new Error('The connection dropped.'));xhr.send(file);
 });
}
export function BigUpload({exams}:{exams:{id:string;name:string;sittings:{id:string;label:string}[]}[]}) {
 const router=useRouter();const[examId,setExamId]=useState(exams[0]?.id??'');const[rows,setRows]=useState<Row[]>([]);const[message,setMessage]=useState('');const[busy,setBusy]=useState(false);const files=useRef<File[]>([]);
 const sittings=exams.find(e=>e.id===examId)?.sittings??[];
 function patch(i:number,change:Partial<Row>){setRows(r=>r.map((row,j)=>j===i?{...row,...change}:row));}
 async function submit(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();const form=new FormData(event.currentTarget);setMessage('');
  const chosen=files.current;if(!chosen.length){setMessage('Choose at least one file.');return;}
  setBusy(true);setRows(chosen.map(f=>({name:f.name,size:f.size,state:'waiting',percent:0})));
  const begun=await beginBigUpload({examId,sourceLabel:String(form.get('sourceLabel')||chosen[0].name),sittingHint:String(form.get('sittingHint')||''),sittingId:String(form.get('sittingId')||'')||null,requestId:crypto.randomUUID(),files:chosen.map(f=>({name:f.name,size:f.size}))});
  if(begun.error||!begun.uploads||!begun.batchId){setMessage(begun.error??'The upload could not start.');setBusy(false);return;}
  const targets=begun.uploads;const byName=new Map<string,number[]>();chosen.forEach((f,i)=>byName.set(f.name,[...(byName.get(f.name)??[]),i]));
  const queue=targets.map(t=>({t,index:(byName.get(t.name)??[]).shift()!}));let next=0;
  async function worker(){
   while(next<queue.length){
    const {t,index}=queue[next++];patch(index,{state:'uploading',percent:0});let ok=false,error='';
    for(let attempt=1;attempt<=3&&!ok;attempt++){
     try{await put(t.url,chosen[index],p=>patch(index,{percent:p}));const c=await confirmBigUpload(t.id);if(c.ok)ok=true;else error=c.error??'The file was not accepted.';}
     catch(e){error=e instanceof Error?e.message:'Upload failed.';}
    }
    patch(index,ok?{state:'done',percent:100}:{state:'failed',error});
   }
  }
  await Promise.all([worker(),worker(),worker()]);
  const done=await finishBigUpload(begun.batchId);
  setBusy(false);setMessage(done.error??`${done.queued} file${done.queued===1?'':'s'} queued for processing${done.missed?`; ${done.missed} did not upload and must be added again`:''}.`);router.refresh();
 }
 return <form onSubmit={submit}>
  <label className="studio-field">Exam<select value={examId} onChange={e=>setExamId(e.target.value)}>{exams.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
  <label className="studio-field"><span>Sitting <small>optional</small></span><select name="sittingId" defaultValue="" key={examId}><option value="">Not known</option>{sittings.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
  <label className="studio-field">Files <span className="studio-help">Up to 200 files and 500 MB in total. Documents up to 100 MB each, images up to 25 MB.</span><input type="file" multiple disabled={busy} accept=".txt,.zip,.csv,.tsv,.md,.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif" onChange={e=>{files.current=[...(e.target.files??[])];setRows([]);}}/></label>
  <label className="studio-field">Source label<input name="sourceLabel" maxLength={200} placeholder="e.g. September 2026 candidate group"/></label>
  <label className="studio-field"><span>Other sitting hint <small>optional</small></span><input name="sittingHint" maxLength={120}/></label>
  <p className="studio-help">Files are kept in private storage only until they are processed, then deleted. Common identifiers are removed from the text before drafting; automatic removal may miss some. Every question needs human review.</p>
  {message&&<p className="studio-feedback" role="status">{message}</p>}
  {rows.length>0&&<ul className="studio-jobs" aria-live="polite">{rows.map((r,i)=><li key={i} className={`studio-job is-${r.state==='failed'?'failed':r.state==='done'?'ready':'refining'}`}><strong>{r.name}</strong><span>{mb(r.size)} · {r.state==='waiting'?'Waiting':r.state==='uploading'?`Uploading ${r.percent}%`:r.state==='done'?'Uploaded':`Failed: ${r.error}`}</span></li>)}</ul>}
  <button className="studio-button" disabled={busy||!exams.length}>{busy?'Uploading…':'Upload and draft'}</button>
 </form>;
}
export function BatchList({batches,onRetry}:{batches:BatchProgress[];onRetry?:never}) {
 const router=useRouter();const[notice,setNotice]=useState('');
 const active=batches.some(b=>b.queued+b.processing>0);
 useEffect(()=>{if(!active)return;const id=setInterval(()=>router.refresh(),5000);return()=>clearInterval(id);},[active,router]);
 if(!batches.length)return null;
 return <>{notice&&<p className="studio-feedback studio-error" role="alert">{notice}</p>}<ul className="studio-jobs" aria-live="polite">{batches.map(b=><li key={b.id} className={`studio-job is-${b.failed?'failed':b.queued+b.processing?'refining':'ready'}`}>
  <strong>{b.label}</strong><span>{b.examName} · {b.files} file{b.files===1?'':'s'} · {mb(b.totalBytes)}</span>
  <span>{b.done} processed{b.queued+b.processing?` · ${b.queued+b.processing} in progress`:''}{b.failed?` · ${b.failed} failed`:''} · {b.jobs} AI job{b.jobs===1?'':'s'}</span>
  {b.failures.map(f=><span key={f.id} className="studio-job-error">{f.name}: {f.error??'Failed'} <button type="button" className="studio-link-button" onClick={async()=>{const r=await retryBigUpload(f.id);if(r.error)setNotice(r.error);else{setNotice('');router.refresh();}}}>Retry</button></span>)}
 </li>)}</ul></>;
}
