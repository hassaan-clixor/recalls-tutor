import {redirect} from 'next/navigation';
import {getCurrentActor} from '@/lib/auth/session';
import {staffAccess} from '@/lib/auth/actor';
import {getDatabase} from '@/lib/db/client';
import {GHL_EVENTS,GHL_EVENT_LABEL,listGhlConnections,listGhlLog} from '@/lib/services/ghl';
import {StudioShell} from '@/components/studio/nav';
import {BackfillButton,ConnectionForm,NewConnectionForm,RemoveButton,RetryButton,TestButton} from '@/components/studio/ghl';
import '../studio.css';
export const metadata={title:'Integrations'};
export const dynamic='force-dynamic';
// GHL-1..5: connections, event settings and the sync log for the outbound GoHighLevel integration.
export default async function IntegrationsPage() {
 const actor=await getCurrentActor();const access=staffAccess(actor);
 if(access==='unauthenticated')redirect('/sign-in');if(access==='unverified')redirect('/verify-email');if(access==='mfa_required')redirect('/account/security');
 if(access!=='allowed'||!actor||actor.role!=='super_admin')return <StudioShell current="integrations" actor={actor} title="Super Admin access required." sub="Integrations are managed by a Super Admin."/>;
 const db=getDatabase();
 const [connections,log,exams]=await Promise.all([listGhlConnections(db,actor.id),listGhlLog(db,actor.id),db.query<{id:string;name:string}>('SELECT id,name FROM exams ORDER BY name')]);
 const when=(v:string|null)=>v?new Date(v).toLocaleString('en-GB',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})+' UTC':'—';
 return <StudioShell current="integrations" actor={actor} title="Integrations" sub="GoHighLevel: students, trials and purchases are sent to your CRM in the background. A GoHighLevel outage never blocks signup, payment or practice. Question content is never sent.">
  <div className="students-columns">
   <section className="catalogue-panel" aria-labelledby="conn-title"><h2 id="conn-title">GoHighLevel connections</h2>
    {connections.length?connections.map(c=><article key={c.id} className="catalogue-panel">
     <h3>{c.name} <small className="studio-help">{c.examName??'All exams'} · location {c.locationId}</small></h3>
     <p className="studio-help">{c.enabled?'Syncing on':'Syncing off'} · {c.delivered} delivered · {c.pending} waiting · {c.failed} failed · last success {when(c.lastOkAt)}</p>
     {c.lastError&&<p className="studio-feedback studio-error" role="alert">Last error: {c.lastError}</p>}
     <div className="catalogue-inline"><TestButton id={c.id}/><BackfillButton id={c.id}/><RemoveButton id={c.id}/></div>
     <details><summary>Settings</summary><ConnectionForm c={c} events={[...GHL_EVENTS]} labels={GHL_EVENT_LABEL}/></details>
    </article>):<p className="studio-empty">No connection yet. Add one to start syncing.</p>}</section>
   <section className="catalogue-panel" aria-labelledby="new-title"><h2 id="new-title">Add a connection</h2><NewConnectionForm exams={exams}/>
    <p className="studio-help">Create a Private Integration in the GoHighLevel sub-account with contact and opportunity access, and paste its token here. Marketing consent is sent as a field; GoHighLevel workflows must respect it.</p></section>
  </div>
  <section className="catalogue-panel" aria-labelledby="log-title"><h2 id="log-title">Sync log</h2>
   {log.length?<div className="partner-scroll"><table className="catalogue-table"><thead><tr><th scope="col">When</th><th scope="col">Contact</th><th scope="col">Event</th><th scope="col">Status</th><th scope="col">Detail</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
    {log.map(r=><tr key={r.id}><td>{when(r.createdAt)}</td><th scope="row">{r.email??'(removed)'}<span className="studio-help team-email">{r.examName??''} · {r.connectionName}</span></th><td>{GHL_EVENT_LABEL[r.event as keyof typeof GHL_EVENT_LABEL]??r.event}</td><td>{r.status}{r.attempts>1?` (${r.attempts} tries)`:''}</td><td>{r.lastError??''}</td><td>{(r.status==='failed'||r.status==='skipped')&&<RetryButton id={r.id}/>}</td></tr>)}</tbody></table></div>
    :<p className="studio-empty">Nothing has been sent yet.</p>}
  </section>
 </StudioShell>;
}
