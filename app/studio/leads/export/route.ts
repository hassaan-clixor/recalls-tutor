import {getCurrentActor} from '@/lib/auth/session';
import {staffAccess} from '@/lib/auth/actor';
import {getDatabase} from '@/lib/db/client';
import {leadsCsv} from '@/lib/services/leads';
export const dynamic='force-dynamic';
// Super Admin only: everyone who left an email on an exam page, with the consent they gave.
export async function GET() {
 const actor=await getCurrentActor();
 if(staffAccess(actor)!=='allowed'||!actor||actor.role!=='super_admin')return new Response('Super Admin access required.',{status:403});
 return new Response(await leadsCsv(getDatabase(),actor.id),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="recalls-tutor-leads.csv"','Cache-Control':'no-store'}});
}
