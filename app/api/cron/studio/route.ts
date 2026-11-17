import {getDatabase} from '@/lib/db/client';
import {cronAuthorized} from '@/lib/integrations/cron';
import {defaultRecallModel} from '@/lib/integrations/llm/anthropic';
import {recoverQueuedStudioJob} from '@/lib/services/ai-studio';
import {configuredStorage} from '@/lib/integrations/storage';
import {defaultVisionReader} from '@/lib/integrations/llm/vision';
import {processNextUpload,sweepUploads} from '@/lib/services/upload-batches';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request) {
 if(!cronAuthorized(request))return Response.json({error:'Unauthorized'},{status:401});
 try{
  const db=getDatabase(),model=defaultRecallModel(),storage=configuredStorage(),started=Date.now();
  // Extract stored files first (one at a time, no AI call yet), then draft queued jobs one at a time. New work only
  // starts in the first 150 seconds so a long AI call has room to finish inside the 300-second limit.
  let uploads=0,jobs=0;let sweep=null;
  if(storage){
   while(Date.now()-started<150000&&await processNextUpload(db,{storage,reader:defaultVisionReader(),model,runJobs:false}))uploads++;
   sweep=await sweepUploads(db,storage);
  }
  while(Date.now()-started<150000){const r=await recoverQueuedStudioJob(db,model);if(!r.found)break;jobs++;}
  return Response.json({uploads,jobs,sweep});
 }
 catch{return Response.json({error:'Studio recovery could not start.'},{status:503});}
}
