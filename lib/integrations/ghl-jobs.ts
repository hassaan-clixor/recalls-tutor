import {getDatabase} from '../db/client';
import {getPrediction} from '../services/predictor';
import {runGhlSync} from '../services/ghl';
// Student-facing flows call triggerGhlSync() after they succeed. It runs after the response is sent and swallows
// every error, so a GHL outage can never break signup, payment or practice. The cron route retries anything missed.
export async function ghlBandFor(userId:string,examId:string) {
 return (await getPrediction(getDatabase(),userId,examId))?.estimate?.band??null;
}
export function triggerGhlSync() {
 const run=()=>runGhlSync(getDatabase(),{bandFor:ghlBandFor}).catch(e=>console.error('GoHighLevel sync failed',e instanceof Error?e.message:'unknown error'));
 // next/server is loaded lazily so tests and scripts that import services never need the request runtime.
 import('next/server').then(({after})=>{try{after(run);}catch{void run();}}).catch(()=>{void run();});
}
