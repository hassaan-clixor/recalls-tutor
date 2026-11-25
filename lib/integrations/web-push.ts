import {createPrivateKey,sign} from 'node:crypto';

// Web push without a payload: the browser wakes the service worker, which shows a fixed message. No encryption library
// is needed and no student data travels through the push service. Needs VAPID keys (see docs/deployment.md).
const ALLOWED_HOSTS=[/^fcm\.googleapis\.com$/,/\.push\.services\.mozilla\.com$/,/\.push\.apple\.com$/,/\.notify\.windows\.com$/];
export const vapidConfigured=()=>Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY);
export const pushEndpointAllowed=(endpoint:string)=>{try{const u=new URL(endpoint);return u.protocol==='https:'&&ALLOWED_HOSTS.some(r=>r.test(u.hostname));}catch{return false;}};
const b64u=(buf:Buffer)=>buf.toString('base64url');
function vapidJwt(audience:string){
 const pub=Buffer.from(process.env.VAPID_PUBLIC_KEY!,'base64url'),d=process.env.VAPID_PRIVATE_KEY!;
 const key=createPrivateKey({key:{kty:'EC',crv:'P-256',d,x:b64u(pub.subarray(1,33)),y:b64u(pub.subarray(33,65))},format:'jwk'});
 const head=b64u(Buffer.from(JSON.stringify({typ:'JWT',alg:'ES256'}))),body=b64u(Buffer.from(JSON.stringify({aud:audience,exp:Math.floor(Date.now()/1000)+12*3600,sub:process.env.VAPID_SUBJECT||'mailto:support@recallstutor.com'})));
 return `${head}.${body}.${b64u(sign('sha256',Buffer.from(`${head}.${body}`),{key,dsaEncoding:'ieee-p1363'}))}`;
}
// Returns 'sent', 'gone' (the subscription expired and should be deleted) or 'failed'.
export async function sendPushTickle(endpoint:string):Promise<'sent'|'gone'|'failed'> {
 if(!vapidConfigured()||!pushEndpointAllowed(endpoint))return 'failed';
 try{
  const res=await fetch(endpoint,{method:'POST',headers:{Authorization:`vapid t=${vapidJwt(new URL(endpoint).origin)}, k=${process.env.VAPID_PUBLIC_KEY}`,TTL:'43200',Urgency:'normal','Content-Length':'0'},signal:AbortSignal.timeout(8000)});
  if(res.status===404||res.status===410)return 'gone';
  return res.ok?'sent':'failed';
 }catch{return 'failed';}
}
