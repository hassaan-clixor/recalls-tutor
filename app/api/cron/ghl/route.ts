import {getDatabase} from '@/lib/db/client';
import {cronAuthorized} from '@/lib/integrations/cron';
import {checkGhlConnection,runGhlSync} from '@/lib/services/ghl';
import {ghlBandFor} from '@/lib/integrations/ghl-jobs';
export const dynamic='force-dynamic';
// Scheduled sync: creates newly true events, delivers or retries queued ones, and checks connection health once a day.
export async function GET(request:Request) {
 if(!cronAuthorized(request))return Response.json({error:'Unauthorized'},{status:401});
 const db=getDatabase();
 const result=await runGhlSync(db,{bandFor:ghlBandFor});
 const stale=await db.query<{id:string}>(`SELECT id FROM ghl_connections WHERE enabled AND (last_checked_at IS NULL OR last_checked_at<now()-interval '23 hours')`);
 for(const c of stale)await checkGhlConnection(db,c.id).catch(()=>{});
 return Response.json({result,checked:stale.length});
}
