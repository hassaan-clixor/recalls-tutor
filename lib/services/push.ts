import type {Database} from '../db/client';
import {pushEndpointAllowed,sendPushTickle,vapidConfigured} from '../integrations/web-push';

export async function savePushSubscription(db:Database,userId:string,endpoint:string) {
 if(!pushEndpointAllowed(endpoint))throw new Error('This browser’s push service is not supported.');
 await db.query('INSERT INTO push_subscriptions(user_id,endpoint) VALUES($1,$2) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id',[userId,endpoint]);
}
export async function removePushSubscription(db:Database,userId:string,endpoint:string) {
 await db.query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2',[userId,endpoint]);
}
// Daily: students with a subscription and at least one review due get one notification (not more than once per 20 hours).
export async function sendDuePushes(db:Database,limit=200) {
 if(!vapidConfigured())return {sent:0,skipped:'VAPID keys are not configured'};
 const {dueReviewIds}=await import('./review');
 const subs=await db.query<{id:string;endpoint:string;user_id:string;exam_id:string|null}>(`SELECT s.id,s.endpoint,s.user_id,(SELECT a.exam_id FROM practice_attempts a WHERE a.user_id=s.user_id ORDER BY a.started_at DESC LIMIT 1) AS exam_id FROM push_subscriptions s WHERE s.last_sent_at IS NULL OR s.last_sent_at<now()-interval '20 hours' LIMIT $1`,[limit]);
 let sent=0;
 for(const s of subs){
  if(!s.exam_id)continue;
  if(!(await dueReviewIds(db,s.user_id,s.exam_id)).length)continue;
  const r=await sendPushTickle(s.endpoint);
  if(r==='gone')await db.query('DELETE FROM push_subscriptions WHERE id=$1',[s.id]);
  else if(r==='sent'){sent++;await db.query('UPDATE push_subscriptions SET last_sent_at=now() WHERE id=$1',[s.id]);}
 }
 return {sent};
}
