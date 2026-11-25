import {getDatabase} from '@/lib/db/client';
import {cronAuthorized} from '@/lib/integrations/cron';
import {sendDuePushes} from '@/lib/services/push';
export const dynamic='force-dynamic';
export const maxDuration=120;
// Daily: a gentle web push to students who have reviews due.
export async function GET(request:Request) {
 if(!cronAuthorized(request))return Response.json({error:'Unauthorized'},{status:401});
 return Response.json(await sendDuePushes(getDatabase()));
}
