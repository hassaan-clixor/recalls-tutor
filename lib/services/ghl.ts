import type {Database} from '../db/client';
import {requireSuperAdmin} from './admin';
import {requireId} from './studio';
import {decryptToken,encryptToken,ghlClient,GhlRejectedError,GhlUnavailableError,type GhlClient} from '../integrations/ghl';
// GHL-1..5 (official PRD section 13): outbound sync of contacts, tags, custom fields and opportunities.
// Design rules: (1) events are derived from committed state and written to ghl_sync_events with a dedupe key, so a
// scan can run any number of times without duplicates; (2) delivery is asynchronous with backoff, so a GHL outage can
// never block signup, payment or practice; (3) no question content is ever sent: only contact, plan and progress data.
export const GHL_EVENTS=['signup','trial_started','trial_ending','trial_expired','checkout_abandoned','purchase','renewal_due','payment_failed','cancelled','renewed','inactive','predictor_band_changed','passed','resit','backfill'] as const;
export type GhlEvent=typeof GHL_EVENTS[number];
export const GHL_EVENT_LABEL:Record<GhlEvent,string>={signup:'Account created',trial_started:'Trial started',trial_ending:'Trial ending (within 24 hours)',trial_expired:'Trial expired',checkout_abandoned:'Checkout started, not paid',purchase:'Purchase completed',renewal_due:'Renewal due in 7 days',payment_failed:'Payment failed',cancelled:'Cancelled',renewed:'Renewal purchased',inactive:'Inactive for 7 days',predictor_band_changed:'Pass Predictor band changed',passed:'Exam result: passed',resit:'Exam result: resit',backfill:'Backfill of an existing student'};
// Tag patterns; {exam} is the exam slug, {months} the plan length and {band} the predictor band. Editable per connection.
export const DEFAULT_TAGS:Record<GhlEvent,string[]>={signup:['rt-signup','rt-{exam}'],trial_started:['rt-trial-active','rt-{exam}'],trial_ending:['rt-trial-ending'],trial_expired:['rt-trial-expired'],checkout_abandoned:['rt-abandoned-checkout'],purchase:['rt-paid-{exam}-{months}m'],renewal_due:['rt-renewal-due'],payment_failed:['rt-payment-failed'],cancelled:['rt-cancelled'],renewed:['rt-renewed'],inactive:['rt-inactive'],predictor_band_changed:['rt-predictor-{band}'],passed:['rt-passed'],resit:['rt-resit'],backfill:['rt-synced']};
export const FIELD_KEYS=['exam','exam_part','exam_diet','exam_date','plan_name','plan_months','renewal_date','auto_renew','trial_status','questions_answered','latest_mock_score','predictor_band','partner_name','country','marketing_consent'] as const;
export type FieldKey=typeof FIELD_KEYS[number];
// Minutes to wait after each failed attempt; after the last one the event is shown as failed and can be retried by hand.
const BACKOFF=[1,5,15,60,180,720,1440];
export const MAX_ATTEMPTS=BACKOFF.length+1;
async function audit(db:Database,actorId:string,entityId:string,action:string,after:unknown) {
 await db.query('INSERT INTO audit_log(actor_id,entity_id,action,after_json) VALUES($1,$2,$3,$4::jsonb)',[actorId,entityId,action,JSON.stringify(after)]);
}
// ------------------------------------------------------------------ connections (Super Admin)
export type GhlConnection={id:string;name:string;locationId:string;examId:string|null;examName:string|null;enabled:boolean;events:string[];tagMap:Record<string,string[]>;fieldMap:Record<string,string>;pipelineMap:Record<string,{pipelineId:string;stageId:string;status:string}>;lastOkAt:string|null;lastError:string|null;lastCheckedAt:string|null;pending:number;failed:number;delivered:number};
const iso=(v:unknown)=>v==null?null:new Date(v as string).toISOString();
export async function listGhlConnections(db:Database,actorId:string):Promise<GhlConnection[]> {
 await requireSuperAdmin(db,actorId);
 const rows=await db.query<Record<string,unknown>>(`SELECT c.id,c.name,c.location_id,c.exam_id,e.name AS exam_name,c.enabled,c.events,c.tag_map,c.field_map,c.pipeline_map,c.last_ok_at,c.last_error,c.last_checked_at,
  (SELECT count(*)::int FROM ghl_sync_events s WHERE s.connection_id=c.id AND s.status='pending') AS pending,
  (SELECT count(*)::int FROM ghl_sync_events s WHERE s.connection_id=c.id AND s.status='failed') AS failed,
  (SELECT count(*)::int FROM ghl_sync_events s WHERE s.connection_id=c.id AND s.status='delivered') AS delivered
  FROM ghl_connections c LEFT JOIN exams e ON e.id=c.exam_id ORDER BY c.created_at`);
 return rows.map(r=>({id:r.id as string,name:r.name as string,locationId:r.location_id as string,examId:r.exam_id as string|null,examName:r.exam_name as string|null,enabled:r.enabled as boolean,events:r.events as string[],
  tagMap:r.tag_map as GhlConnection['tagMap'],fieldMap:r.field_map as GhlConnection['fieldMap'],pipelineMap:r.pipeline_map as GhlConnection['pipelineMap'],lastOkAt:iso(r.last_ok_at),lastError:r.last_error as string|null,lastCheckedAt:iso(r.last_checked_at),
  pending:Number(r.pending),failed:Number(r.failed),delivered:Number(r.delivered)}));
}
export async function createGhlConnection(db:Database,actorId:string,input:{name:string;locationId:string;token:string;examId:string|null}) {
 await requireSuperAdmin(db,actorId);
 const name=input.name.trim(),locationId=input.locationId.trim(),token=input.token.trim();
 if(name.length<2||name.length>80)throw new Error('Enter a connection name of 2 to 80 characters.');
 if(!/^[A-Za-z0-9]{6,64}$/.test(locationId))throw new Error('Enter the GoHighLevel location (sub-account) ID.');
 if(token.length<20||token.length>2000||/\s/.test(token))throw new Error('Enter the private integration token from GoHighLevel.');
 if(input.examId)requireId(input.examId);
 try {
  const [row]=await db.query<{id:string}>('INSERT INTO ghl_connections(name,location_id,token_enc,exam_id,events,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
   [name,locationId,encryptToken(token),input.examId,GHL_EVENTS.filter(e=>e!=='backfill'),actorId]);
  await audit(db,actorId,row.id,'ghl.connection_created',{name,locationId,examId:input.examId});
  return row.id;
 } catch(e) {if(e instanceof Error&&/ghl_connection_scope/.test(e.message))throw new Error('This GoHighLevel location is already connected for that exam.');throw e;}
}
function cleanMaps(input:{tagMap?:unknown;fieldMap?:unknown;pipelineMap?:unknown}) {
 const str=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 const out:{tagMap?:Record<string,string[]>;fieldMap?:Record<string,string>;pipelineMap?:Record<string,{pipelineId:string;stageId:string;status:string}>}={};
 if(input.tagMap!==undefined){
  const m:Record<string,string[]>={};
  for(const [k,v] of Object.entries(input.tagMap as Record<string,unknown>)){
   if(!(GHL_EVENTS as readonly string[]).includes(k))throw new Error(`Unknown event "${k.slice(0,40)}".`);
   if(!Array.isArray(v)||v.length>6||!v.every(t=>str(t,60)&&/^[A-Za-z0-9{}._:-]+$/.test(t as string)))throw new Error(`Tags for ${k} must be up to six short names without spaces.`);
   m[k]=v as string[];
  }
  out.tagMap=m;
 }
 if(input.fieldMap!==undefined){
  const m:Record<string,string>={};
  for(const [k,v] of Object.entries(input.fieldMap as Record<string,unknown>)){
   if(!(FIELD_KEYS as readonly string[]).includes(k))throw new Error(`Unknown field "${k.slice(0,40)}".`);
   if(!str(v,80)||!/^[A-Za-z0-9]+$/.test(v as string))throw new Error(`Enter the GoHighLevel custom field ID for ${k}.`);
   m[k]=v as string;
  }
  out.fieldMap=m;
 }
 if(input.pipelineMap!==undefined){
  const m:Record<string,{pipelineId:string;stageId:string;status:string}>={};
  for(const [k,v] of Object.entries(input.pipelineMap as Record<string,{pipelineId?:unknown;stageId?:unknown;status?:unknown}>)){
   if(!(GHL_EVENTS as readonly string[]).includes(k))throw new Error(`Unknown event "${k.slice(0,40)}".`);
   const status=v.status??'open';
   if(!str(v.pipelineId,80)||!str(v.stageId,80)||!['open','won','lost','abandoned'].includes(status as string))throw new Error(`Pipeline mapping for ${k} needs a pipeline, a stage and a status.`);
   m[k]={pipelineId:v.pipelineId as string,stageId:v.stageId as string,status:status as string};
  }
  out.pipelineMap=m;
 }
 return out;
}
export async function updateGhlConnection(db:Database,actorId:string,id:string,input:{enabled?:boolean;events?:string[];token?:string;tagMap?:unknown;fieldMap?:unknown;pipelineMap?:unknown}) {
 await requireSuperAdmin(db,actorId);requireId(id);
 const maps=cleanMaps(input);
 if(input.events&&!input.events.every(e=>(GHL_EVENTS as readonly string[]).includes(e)))throw new Error('Unknown event.');
 const token=input.token?.trim();
 if(token!==undefined&&token!==''&&(token.length<20||token.length>2000||/\s/.test(token)))throw new Error('Enter the private integration token from GoHighLevel.');
 const rows=await db.query(`UPDATE ghl_connections SET enabled=COALESCE($2,enabled),events=COALESCE($3,events),token_enc=COALESCE($4,token_enc),
  tag_map=COALESCE($5::jsonb,tag_map),field_map=COALESCE($6::jsonb,field_map),pipeline_map=COALESCE($7::jsonb,pipeline_map),last_error=CASE WHEN $4::text IS NULL THEN last_error ELSE NULL END WHERE id=$1 RETURNING id`,
  [id,input.enabled??null,input.events??null,token?encryptToken(token):null,maps.tagMap?JSON.stringify(maps.tagMap):null,maps.fieldMap?JSON.stringify(maps.fieldMap):null,maps.pipelineMap?JSON.stringify(maps.pipelineMap):null]);
 if(!rows.length)throw new Error('Connection not found.');
 await audit(db,actorId,id,'ghl.connection_updated',{enabled:input.enabled,events:input.events,tokenReplaced:Boolean(token),maps:Object.keys(maps)});
}
export async function deleteGhlConnection(db:Database,actorId:string,id:string) {
 await requireSuperAdmin(db,actorId);requireId(id);
 await db.query('DELETE FROM ghl_connections WHERE id=$1',[id]);
 await audit(db,actorId,id,'ghl.connection_deleted',{});
}
export type ClientFactory=(token:string,locationId:string)=>GhlClient;
const defaultFactory:ClientFactory=(token,locationId)=>ghlClient(token,locationId);
// Health check (also run daily by the cron route): a read of the location with the stored token.
export async function checkGhlConnection(db:Database,id:string,factory:ClientFactory=defaultFactory) {
 const [c]=await db.query<{location_id:string;token_enc:string}>('SELECT location_id,token_enc FROM ghl_connections WHERE id=$1',[id]);
 if(!c)throw new Error('Connection not found.');
 try {
  await factory(decryptToken(c.token_enc),c.location_id).checkConnection();
  await db.query('UPDATE ghl_connections SET last_checked_at=now(),last_ok_at=now(),last_error=NULL WHERE id=$1',[id]);
  return {ok:true as const};
 } catch(e) {
  const message=e instanceof Error?e.message:'The connection check failed.';
  await db.query('UPDATE ghl_connections SET last_checked_at=now(),last_error=$2 WHERE id=$1',[id,message.slice(0,300)]);
  return {ok:false as const,error:message};
 }
}
export async function testGhlConnection(db:Database,actorId:string,id:string,factory:ClientFactory=defaultFactory) {
 await requireSuperAdmin(db,actorId);requireId(id);
 return checkGhlConnection(db,id,factory);
}
// ------------------------------------------------------------------ event creation
// Each query lists the users and exams an event applies to. Only activity at or after the connection was created is
// sent here; older students are included only by an explicit backfill. $1 is the connection id.
const ACTIVE_USER=`a.status='active' AND a.role='student'`;
const FULL_ACCESS=`('subscription','partner','complimentary')`;
const EVENT_SQL:Partial<Record<GhlEvent,string>>={
 signup:`SELECT a.id AS user_id,COALESCE(c.exam_id,sp.exam_ids[1]) AS exam_id,'signup:'||a.id AS key FROM ghl_connections c JOIN app_users a ON ${ACTIVE_USER} JOIN auth_users u ON u.id=a.auth_id LEFT JOIN student_profiles sp ON sp.user_id=a.id
  WHERE c.id=$1 AND u.created_at>=c.created_at AND (c.exam_id IS NULL OR sp.exam_ids IS NULL OR cardinality(sp.exam_ids)=0 OR c.exam_id=ANY(sp.exam_ids))`,
 trial_started:`SELECT t.user_id,t.exam_id,'trial:'||t.user_id||':'||t.exam_id AS key FROM ghl_connections c JOIN trials t ON (c.exam_id IS NULL OR t.exam_id=c.exam_id) JOIN app_users a ON a.id=t.user_id AND ${ACTIVE_USER} WHERE c.id=$1 AND t.started_at>=c.created_at`,
 trial_ending:`SELECT t.user_id,t.exam_id,'trial-ending:'||t.user_id||':'||t.exam_id AS key FROM ghl_connections c JOIN trials t ON (c.exam_id IS NULL OR t.exam_id=c.exam_id) JOIN app_users a ON a.id=t.user_id AND ${ACTIVE_USER}
  WHERE c.id=$1 AND t.started_at>=c.created_at AND t.ends_at>now() AND t.ends_at<=now()+interval '24 hours'`,
 trial_expired:`SELECT t.user_id,t.exam_id,'trial-expired:'||t.user_id||':'||t.exam_id AS key FROM ghl_connections c JOIN trials t ON (c.exam_id IS NULL OR t.exam_id=c.exam_id) JOIN app_users a ON a.id=t.user_id AND ${ACTIVE_USER}
  WHERE c.id=$1 AND t.ends_at<=now() AND t.ends_at>=c.created_at AND NOT EXISTS(SELECT 1 FROM entitlements e WHERE e.user_id=t.user_id AND e.exam_id=t.exam_id AND e.source IN ${FULL_ACCESS} AND e.revoked_at IS NULL AND e.ends_at>now())`,
 checkout_abandoned:`SELECT r.user_id,r.exam_id,'abandoned:'||r.user_id||':'||r.exam_id||':'||r.attempt_id AS key FROM ghl_connections c JOIN checkout_reservations r ON (c.exam_id IS NULL OR r.exam_id=c.exam_id) JOIN app_users a ON a.id=r.user_id AND ${ACTIVE_USER}
  WHERE c.id=$1 AND r.created_at>=c.created_at AND r.created_at<now()-interval '1 hour' AND NOT EXISTS(SELECT 1 FROM subscriptions s WHERE s.user_id=r.user_id AND s.exam_id=r.exam_id AND s.created_at>=r.created_at)`,
 purchase:`SELECT p.user_id,p.exam_id,'purchase:'||p.stripe_invoice_id AS key FROM ghl_connections c JOIN billing_payments p ON (c.exam_id IS NULL OR p.exam_id=c.exam_id) JOIN app_users a ON a.id=p.user_id AND ${ACTIVE_USER} WHERE c.id=$1 AND p.kind='new' AND p.paid_at>=c.created_at AND p.exam_id IS NOT NULL`,
 renewed:`SELECT p.user_id,p.exam_id,'renewed:'||p.stripe_invoice_id AS key FROM ghl_connections c JOIN billing_payments p ON (c.exam_id IS NULL OR p.exam_id=c.exam_id) JOIN app_users a ON a.id=p.user_id AND ${ACTIVE_USER} WHERE c.id=$1 AND p.kind='renewal' AND p.paid_at>=c.created_at AND p.exam_id IS NOT NULL`,
 renewal_due:`SELECT s.user_id,s.exam_id,'renewal-due:'||s.id||':'||extract(epoch FROM s.current_period_end)::bigint AS key FROM ghl_connections c JOIN subscriptions s ON (c.exam_id IS NULL OR s.exam_id=c.exam_id) JOIN app_users a ON a.id=s.user_id AND ${ACTIVE_USER}
  WHERE c.id=$1 AND s.status='active' AND NOT s.cancel_at_period_end AND s.current_period_end>now() AND s.current_period_end<=now()+interval '7 days'`,
 payment_failed:`SELECT s.user_id,s.exam_id,'payment-failed:'||s.id||':'||extract(epoch FROM s.grace_until)::bigint AS key FROM ghl_connections c JOIN subscriptions s ON (c.exam_id IS NULL OR s.exam_id=c.exam_id) JOIN app_users a ON a.id=s.user_id AND ${ACTIVE_USER}
  WHERE c.id=$1 AND s.grace_until IS NOT NULL AND s.updated_at>=c.created_at`,
 cancelled:`SELECT s.user_id,s.exam_id,'cancelled:'||s.id||':'||COALESCE(extract(epoch FROM s.current_period_end)::bigint,0) AS key FROM ghl_connections c JOIN subscriptions s ON (c.exam_id IS NULL OR s.exam_id=c.exam_id) JOIN app_users a ON a.id=s.user_id AND ${ACTIVE_USER}
  WHERE c.id=$1 AND (s.cancel_at_period_end OR s.status IN ('canceled','cancelled')) AND s.updated_at>=c.created_at`,
 inactive:`SELECT e.user_id,e.exam_id,'inactive:'||e.user_id||':'||e.exam_id||':'||to_char(now(),'IYYY-IW') AS key FROM ghl_connections c JOIN entitlements e ON (c.exam_id IS NULL OR e.exam_id=c.exam_id) JOIN app_users a ON a.id=e.user_id AND ${ACTIVE_USER}
  LEFT JOIN LATERAL (SELECT max(i.answered_at) AS last FROM practice_items i JOIN practice_attempts p ON p.id=i.attempt_id WHERE p.user_id=e.user_id AND p.exam_id=e.exam_id) act ON true
  WHERE c.id=$1 AND e.source IN ${FULL_ACCESS} AND e.revoked_at IS NULL AND e.starts_at<=now() AND e.ends_at>now() AND e.starts_at<now()-interval '7 days' AND COALESCE(act.last,e.starts_at)<now()-interval '7 days' AND (e.starts_at>=c.created_at OR act.last>=c.created_at)`,
 passed:`SELECT o.user_id,o.exam_id,'passed:'||o.user_id||':'||o.exam_id AS key FROM ghl_connections c JOIN pass_outcomes o ON (c.exam_id IS NULL OR o.exam_id=c.exam_id) JOIN app_users a ON a.id=o.user_id AND ${ACTIVE_USER} WHERE c.id=$1 AND o.passed IS TRUE AND o.answered_at>=c.created_at`,
 resit:`SELECT o.user_id,o.exam_id,'resit:'||o.user_id||':'||o.exam_id AS key FROM ghl_connections c JOIN pass_outcomes o ON (c.exam_id IS NULL OR o.exam_id=c.exam_id) JOIN app_users a ON a.id=o.user_id AND ${ACTIVE_USER} WHERE c.id=$1 AND o.passed IS FALSE AND o.answered_at>=c.created_at`,
};
// Creates any events that are newly true. Safe to run repeatedly. Returns how many rows were added.
export async function collectGhlEvents(db:Database) {
 const conns=await db.query<{id:string;events:string[]}>('SELECT id,events FROM ghl_connections WHERE enabled');
 let added=0;
 for(const c of conns) {
  for(const [event,sql] of Object.entries(EVENT_SQL)) {
   if(!c.events.includes(event))continue;
   const rows=await db.query(`INSERT INTO ghl_sync_events(connection_id,user_id,exam_id,event,dedupe_key) SELECT $1,x.user_id,x.exam_id,$2,x.key FROM (${sql}) x ON CONFLICT(connection_id,dedupe_key) DO NOTHING RETURNING id`,[c.id,event]);
   added+=rows.length;
  }
 }
 return added;
}
// Pass Predictor band changes. The band is computed per student, so this checks a bounded batch each run, oldest first.
export async function collectPredictorEvents(db:Database,bandFor:(userId:string,examId:string)=>Promise<string|null>,limit=50) {
 const conns=await db.query<{id:string;events:string[]}>(`SELECT id,events FROM ghl_connections WHERE enabled AND 'predictor_band_changed'=ANY(events)`);
 let added=0;
 for(const c of conns) {
  const candidates=await db.query<{user_id:string;exam_id:string;prev:string|null;has_state:boolean}>(`SELECT e.user_id,e.exam_id,s.predictor_band AS prev,(s.user_id IS NOT NULL) AS has_state FROM (SELECT DISTINCT user_id,exam_id FROM entitlements WHERE source IN ${FULL_ACCESS} AND revoked_at IS NULL AND ends_at>now()) e
   JOIN ghl_connections c ON c.id=$1 AND (c.exam_id IS NULL OR c.exam_id=e.exam_id) JOIN app_users a ON a.id=e.user_id AND ${ACTIVE_USER}
   LEFT JOIN ghl_contact_state s ON s.connection_id=c.id AND s.user_id=e.user_id AND s.exam_id=e.exam_id ORDER BY s.checked_at NULLS FIRST LIMIT $2`,[c.id,limit]);
  for(const r of candidates) {
   const band=await bandFor(r.user_id,r.exam_id).catch(()=>null);
   await db.query(`INSERT INTO ghl_contact_state(connection_id,user_id,exam_id,predictor_band) VALUES($1,$2,$3,$4) ON CONFLICT(connection_id,user_id,exam_id) DO UPDATE SET predictor_band=EXCLUDED.predictor_band,checked_at=now()`,[c.id,r.user_id,r.exam_id,band]);
   // The first observation only records a baseline; later changes to a known band create an event.
   if(band&&r.has_state&&band!==r.prev){
    const rows=await db.query(`INSERT INTO ghl_sync_events(connection_id,user_id,exam_id,event,dedupe_key) VALUES($1,$2,$3,'predictor_band_changed',$4) ON CONFLICT DO NOTHING RETURNING id`,[c.id,r.user_id,r.exam_id,`band:${r.user_id}:${r.exam_id}:${band}:${Date.now()}`]);
    added+=rows.length;
   }
  }
 }
 return added;
}
// One-click backfill of existing students (PRD 13.4): every active student with a plan, trial or chosen exam.
export async function backfillGhl(db:Database,actorId:string,connectionId:string) {
 await requireSuperAdmin(db,actorId);requireId(connectionId);
 const rows=await db.query(`WITH pairs AS (
   SELECT user_id,exam_id FROM entitlements WHERE revoked_at IS NULL UNION SELECT user_id,exam_id FROM trials UNION SELECT user_id,unnest(exam_ids) FROM student_profiles
  ), all_pairs AS (SELECT user_id,exam_id FROM pairs UNION SELECT a.id,NULL::uuid FROM app_users a WHERE NOT EXISTS(SELECT 1 FROM pairs p WHERE p.user_id=a.id))
  INSERT INTO ghl_sync_events(connection_id,user_id,exam_id,event,dedupe_key)
  SELECT c.id,x.user_id,x.exam_id,'backfill','backfill:'||x.user_id||':'||COALESCE(x.exam_id::text,'none') FROM ghl_connections c JOIN all_pairs x ON (c.exam_id IS NULL OR x.exam_id=c.exam_id)
  JOIN app_users a ON a.id=x.user_id AND ${ACTIVE_USER} WHERE c.id=$1 ON CONFLICT(connection_id,dedupe_key) DO NOTHING RETURNING id`,[connectionId]);
 await audit(db,actorId,connectionId,'ghl.backfill_queued',{events:rows.length});
 return rows.length;
}
// ------------------------------------------------------------------ delivery
export type Snapshot={email:string;name:string;examSlug:string|null;examName:string|null;familyName:string|null;fields:Record<FieldKey,string|number|boolean|null>;consent:boolean;months:number|null};
export async function contactSnapshot(db:Database,userId:string,examId:string|null,connectionId:string):Promise<Snapshot|null> {
 const [u]=await db.query<Record<string,unknown>>(`SELECT u.email,u.name,sp.country,sp.exam_date::text AS exam_date,sp.marketing_emails FROM app_users a JOIN auth_users u ON u.id=a.auth_id LEFT JOIN student_profiles sp ON sp.user_id=a.id WHERE a.id=$1 AND a.status='active'`,[userId]);
 if(!u)return null;
 let exam:Record<string,unknown>|undefined;
 if(examId)[exam]=await db.query<Record<string,unknown>>('SELECT e.slug,e.name,f.name AS family FROM exams e JOIN exam_families f ON f.id=e.family_id WHERE e.id=$1',[examId]);
 const base:Snapshot['fields']={exam:null,exam_part:null,exam_diet:null,exam_date:(u.exam_date as string|null)??null,plan_name:null,plan_months:null,renewal_date:null,auto_renew:null,trial_status:null,questions_answered:null,latest_mock_score:null,predictor_band:null,partner_name:null,country:(u.country as string)||null,marketing_consent:u.marketing_emails===true};
 let months:number|null=null;
 if(examId&&exam) {
  base.exam=exam.family as string;base.exam_part=exam.name as string;
  const [sit]=await db.query<{label:string}>('SELECT label FROM sittings WHERE exam_id=$1 AND published ORDER BY year DESC,starts_on DESC NULLS LAST LIMIT 1',[examId]);
  base.exam_diet=sit?.label??null;
  const [sub]=await db.query<{months:number;period_end:string;cancel:boolean;status:string}>(`SELECT p.months,s.current_period_end AS period_end,s.cancel_at_period_end AS cancel,s.status FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=$1 AND s.exam_id=$2 ORDER BY (s.status IN ('active','past_due','trialing')) DESC,s.created_at DESC LIMIT 1`,[userId,examId]);
  if(sub){months=sub.months;base.plan_months=sub.months;base.plan_name=`${exam.name} — ${sub.months} months`;base.renewal_date=sub.period_end?new Date(sub.period_end).toISOString().slice(0,10):null;base.auto_renew=!sub.cancel&&sub.status==='active';}
  const [t]=await db.query<{ends_at:string;full:boolean}>(`SELECT t.ends_at,EXISTS(SELECT 1 FROM entitlements e WHERE e.user_id=t.user_id AND e.exam_id=t.exam_id AND e.source IN ${FULL_ACCESS} AND e.revoked_at IS NULL AND e.ends_at>now()) AS full FROM trials t WHERE t.user_id=$1 AND t.exam_id=$2`,[userId,examId]);
  base.trial_status=!t?'none':t.full?'converted':new Date(t.ends_at)>new Date()?'active':'expired';
  const [n]=await db.query<{n:number}>('SELECT count(*)::int AS n FROM practice_items i JOIN practice_attempts p ON p.id=i.attempt_id WHERE p.user_id=$1 AND p.exam_id=$2 AND i.selected IS NOT NULL',[userId,examId]);
  base.questions_answered=n?.n??0;
  const [m]=await db.query<{score:string|null}>(`SELECT round(100.0*count(*) FILTER (WHERE i.correct)/NULLIF(count(*),0),1)::text AS score FROM practice_items i WHERE i.attempt_id=(SELECT id FROM practice_attempts WHERE user_id=$1 AND exam_id=$2 AND mode='exam' AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 1)`,[userId,examId]);
  base.latest_mock_score=m?.score==null?null:Number(m.score);
  const [st]=await db.query<{predictor_band:string|null}>('SELECT predictor_band FROM ghl_contact_state WHERE connection_id=$1 AND user_id=$2 AND exam_id=$3',[connectionId,userId,examId]);
  base.predictor_band=st?.predictor_band??null;
  const [pt]=await db.query<{name:string}>(`SELECT o.name FROM entitlements e JOIN organisations o ON o.id=e.organisation_id WHERE e.user_id=$1 AND e.exam_id=$2 AND e.source='partner' AND e.revoked_at IS NULL AND e.ends_at>now() ORDER BY e.ends_at DESC LIMIT 1`,[userId,examId]);
  base.partner_name=pt?.name??null;
 }
 return {email:String(u.email).toLowerCase(),name:String(u.name??''),examSlug:(exam?.slug as string)??null,examName:(exam?.name as string)??null,familyName:(exam?.family as string)??null,fields:base,consent:u.marketing_emails===true,months};
}
function expandTags(patterns:string[],snap:Snapshot,band:string|null) {
 const out=new Set<string>();
 for(const p of patterns) {
  if(p.includes('{exam}')&&!snap.examSlug)continue;
  if(p.includes('{months}')&&snap.months===null)continue;
  if(p.includes('{band}')&&!band)continue;
  out.add(p.replaceAll('{exam}',snap.examSlug??'').replaceAll('{months}',String(snap.months??'')).replaceAll('{band}',(band??'').replaceAll('_','-')).toLowerCase());
 }
 return [...out];
}
export function backoffMinutes(attempt:number) {return BACKOFF[attempt-1]??null;}
// Claims due rows with a short lease so two workers never send the same event, then delivers each one.
export async function deliverGhlEvents(db:Database,options:{factory?:ClientFactory;limit?:number}={}) {
 const factory=options.factory??defaultFactory;
 const due=await db.query<{id:string;connection_id:string;user_id:string;exam_id:string|null;event:string;attempts:number}>(`UPDATE ghl_sync_events SET next_attempt_at=now()+interval '5 minutes'
  WHERE id IN (SELECT s.id FROM ghl_sync_events s JOIN ghl_connections c ON c.id=s.connection_id AND c.enabled WHERE s.status='pending' AND s.next_attempt_at<=now() ORDER BY s.next_attempt_at LIMIT $1 FOR UPDATE OF s SKIP LOCKED)
  RETURNING id,connection_id,user_id,exam_id,event,attempts`,[options.limit??25]);
 const out={sent:due.length,delivered:0,skipped:0,retrying:0,failed:0};
 const conns=new Map<string,{loc:string;token:string;tagMap:Record<string,string[]>;fieldMap:Record<string,string>;pipelineMap:Record<string,{pipelineId:string;stageId:string;status:string}>;client:GhlClient}|{error:string}>();
 for(const d of due) {
  let conn=conns.get(d.connection_id);
  if(!conn) {
   const [c]=await db.query<{location_id:string;token_enc:string;tag_map:Record<string,string[]>;field_map:Record<string,string>;pipeline_map:Record<string,{pipelineId:string;stageId:string;status:string}>}>('SELECT location_id,token_enc,tag_map,field_map,pipeline_map FROM ghl_connections WHERE id=$1',[d.connection_id]);
   try {const token=decryptToken(c.token_enc);conn={loc:c.location_id,token,tagMap:c.tag_map,fieldMap:c.field_map,pipelineMap:c.pipeline_map,client:factory(token,c.location_id)};}
   catch(e) {conn={error:e instanceof Error?e.message:'The token could not be read.'};}
   conns.set(d.connection_id,conn);
  }
  const attempts=d.attempts+1;
  const fail=async(message:string,permanent:boolean,status:number|null=null)=>{
   const wait=permanent?null:backoffMinutes(attempts);
   if(wait==null){await db.query(`UPDATE ghl_sync_events SET status='failed',attempts=$2,last_error=$3,last_status=$4,next_attempt_at=NULL WHERE id=$1`,[d.id,attempts,message.slice(0,300),status]);out.failed++;}
   else {await db.query(`UPDATE ghl_sync_events SET attempts=$2,last_error=$3,last_status=$4,next_attempt_at=now()+make_interval(mins=>$5::int) WHERE id=$1`,[d.id,attempts,message.slice(0,300),status,wait]);out.retrying++;}
   await db.query('UPDATE ghl_connections SET last_error=$2 WHERE id=$1',[d.connection_id,message.slice(0,300)]);
  };
  if('error' in conn){await fail(conn.error,true);continue;}
  const snap=await contactSnapshot(db,d.user_id,d.exam_id,d.connection_id);
  if(!snap){await db.query(`UPDATE ghl_sync_events SET status='skipped',attempts=$2,last_error='The account is no longer active.',next_attempt_at=NULL WHERE id=$1`,[d.id,attempts]);out.skipped++;continue;}
  try {
   const event=d.event as GhlEvent;
   const band=snap.fields.predictor_band as string|null;
   const patterns=conn.tagMap[event]??DEFAULT_TAGS[event]??[];
   const tags=expandTags(patterns,snap,band);
   if(!snap.consent)tags.push('rt-no-marketing-consent');
   const customFields=Object.entries(conn.fieldMap).flatMap(([key,id])=>{const v=snap.fields[key as FieldKey];return v===null||v===undefined?[]:[{id,field_value:typeof v==='boolean'?(v?'Yes':'No'):v}];});
   const [first,...rest]=snap.name.trim().split(/\s+/);
   const contact=await conn.client.upsertContact({email:snap.email,firstName:first||undefined,lastName:rest.join(' ')||undefined,tags,customFields});
   const pipe=conn.pipelineMap[event];
   if(pipe)await conn.client.upsertOpportunity({pipelineId:pipe.pipelineId,pipelineStageId:pipe.stageId,contactId:contact.id,name:`${snap.examName??'Recalls Tutor'} — ${snap.email}`,status:pipe.status as 'open'});
   await db.query(`UPDATE ghl_sync_events SET status='delivered',attempts=$2,delivered_at=now(),last_error=NULL,last_status=200,ghl_contact_id=$3,next_attempt_at=NULL WHERE id=$1`,[d.id,attempts,contact.id]);
   await db.query('UPDATE ghl_connections SET last_ok_at=now(),last_error=NULL WHERE id=$1',[d.connection_id]);
   out.delivered++;
  } catch(e) {
   if(e instanceof GhlUnavailableError)await fail(e.message,false);
   else if(e instanceof GhlRejectedError)await fail(e.message,true,e.status);
   else await fail('The event could not be prepared.',true);
  }
 }
 return out;
}
// Used by the cron route and right after a signup, trial or Stripe event. Never throws into the caller's flow.
export async function runGhlSync(db:Database,options:{factory?:ClientFactory;bandFor?:(userId:string,examId:string)=>Promise<string|null>}={}) {
 const [{n}]=await db.query<{n:number}>('SELECT count(*)::int AS n FROM ghl_connections WHERE enabled');
 if(!n)return null;
 const created=await collectGhlEvents(db);
 const predictor=options.bandFor?await collectPredictorEvents(db,options.bandFor):0;
 const delivery=await deliverGhlEvents(db,{factory:options.factory,limit:100});
 return {created,predictor,...delivery};
}
// ------------------------------------------------------------------ sync log
export type SyncRow={id:string;connectionName:string;email:string|null;examName:string|null;event:string;status:string;attempts:number;lastError:string|null;createdAt:string;deliveredAt:string|null};
export async function listGhlLog(db:Database,actorId:string,filter:{connectionId?:string;status?:string}={}):Promise<SyncRow[]> {
 await requireSuperAdmin(db,actorId);
 if(filter.connectionId)requireId(filter.connectionId);
 const rows=await db.query<Record<string,unknown>>(`SELECT s.id,c.name AS connection_name,u.email,e.name AS exam_name,s.event,s.status,s.attempts,s.last_error,s.created_at,s.delivered_at FROM ghl_sync_events s JOIN ghl_connections c ON c.id=s.connection_id
  JOIN app_users a ON a.id=s.user_id LEFT JOIN auth_users u ON u.id=a.auth_id LEFT JOIN exams e ON e.id=s.exam_id WHERE ($1::uuid IS NULL OR s.connection_id=$1) AND ($2::text IS NULL OR s.status=$2) ORDER BY s.created_at DESC LIMIT 100`,[filter.connectionId??null,filter.status??null]);
 return rows.map(r=>({id:r.id as string,connectionName:r.connection_name as string,email:(r.email as string|null)??null,examName:(r.exam_name as string|null)??null,event:r.event as string,status:r.status as string,attempts:Number(r.attempts),lastError:(r.last_error as string|null)??null,createdAt:iso(r.created_at)!,deliveredAt:iso(r.delivered_at)}));
}
export async function retryGhlEvent(db:Database,actorId:string,eventId:string) {
 await requireSuperAdmin(db,actorId);requireId(eventId);
 const rows=await db.query(`UPDATE ghl_sync_events SET status='pending',attempts=0,next_attempt_at=now(),last_error=NULL WHERE id=$1 AND status IN ('failed','skipped') RETURNING id`,[eventId]);
 if(!rows.length)throw new Error('Only failed or skipped events can be retried.');
 await audit(db,actorId,eventId,'ghl.event_retried',{});
}
