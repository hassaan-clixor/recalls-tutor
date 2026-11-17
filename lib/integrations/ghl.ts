import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
// GHL API v2 adapter. The host is fixed so a stored setting can never redirect contact data elsewhere.
// Request and response shapes follow GoHighLevel's public API v2 documentation and are NOT yet verified against a
// live sub-account: run the verification steps in docs/gohighlevel-integration.md before relying on it.
export const GHL_BASE='https://services.leadconnectorhq.com';
export const GHL_VERSION='2021-07-28';
// A rate limit, outage or timeout is retried; anything else (bad token, unknown field) is a configuration problem.
export class GhlUnavailableError extends Error {
 constructor(message:string,readonly retryAfterSeconds=60){super(message);this.name='GhlUnavailableError';}
}
export class GhlRejectedError extends Error {
 constructor(message:string,readonly status:number){super(message);this.name='GhlRejectedError';}
}
export type GhlContactInput={email:string;firstName?:string;lastName?:string;phone?:string|null;tags:string[];customFields:{id:string;field_value:string|number|boolean}[]};
export type GhlOpportunityInput={pipelineId:string;pipelineStageId:string;contactId:string;name:string;status?:'open'|'won'|'lost'|'abandoned';monetaryValue?:number};
export interface GhlClient {
 upsertContact(input:GhlContactInput):Promise<{id:string;isNew:boolean}>;
 upsertOpportunity(input:GhlOpportunityInput):Promise<{id:string}>;
 checkConnection():Promise<void>;
}
type Fetcher=typeof fetch;
export function ghlClient(token:string,locationId:string,fetcher:Fetcher=fetch,timeoutMs=15000):GhlClient {
 async function call(method:'GET'|'POST',path:string,body?:unknown):Promise<Record<string,unknown>> {
  let response:Response;
  try {
   response=await fetcher(`${GHL_BASE}${path}`,{method,redirect:'manual',signal:AbortSignal.timeout(timeoutMs),
    headers:{Authorization:`Bearer ${token}`,Version:GHL_VERSION,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined});
  } catch {throw new GhlUnavailableError('GoHighLevel could not be reached.');}
  if(response.status===429||response.status>=500){
   const wait=Number(response.headers.get('retry-after'));
   throw new GhlUnavailableError(`GoHighLevel answered ${response.status}.`,Number.isFinite(wait)&&wait>0?Math.min(3600,wait):60);
  }
  if(response.status===401||response.status===403)throw new GhlRejectedError('GoHighLevel rejected the access token or its scopes.',response.status);
  if(!response.ok)throw new GhlRejectedError(`GoHighLevel rejected the request (${response.status}).`,response.status);
  try {return await response.json() as Record<string,unknown>;}
  catch {throw new GhlUnavailableError('GoHighLevel returned an unreadable response.');}
 }
 return {
  async upsertContact(input) {
   const body=await call('POST','/contacts/upsert',{locationId,email:input.email,firstName:input.firstName,lastName:input.lastName,...(input.phone?{phone:input.phone}:{}),tags:input.tags,customFields:input.customFields});
   const id=(body.contact as {id?:unknown}|undefined)?.id;
   if(typeof id!=='string'||!id)throw new GhlRejectedError('GoHighLevel did not return a contact id.',502);
   return {id,isNew:body.new===true};
  },
  async upsertOpportunity(input) {
   const body=await call('POST','/opportunities/upsert',{locationId,...input});
   const id=(body.opportunity as {id?:unknown}|undefined)?.id;
   if(typeof id!=='string'||!id)throw new GhlRejectedError('GoHighLevel did not return an opportunity id.',502);
   return {id};
  },
  async checkConnection() {await call('GET',`/locations/${encodeURIComponent(locationId)}`);},
 };
}
// ---- Token storage: AES-256-GCM with a key from GHL_ENCRYPTION_KEY (preferred) or the auth secret.
function key() {
 const secret=process.env.GHL_ENCRYPTION_KEY||process.env.BETTER_AUTH_SECRET;
 if(!secret&&process.env.NODE_ENV==='production')throw new Error('GHL_ENCRYPTION_KEY or BETTER_AUTH_SECRET is required to store GoHighLevel tokens.');
 return createHash('sha256').update(`ghl-token:${secret??'local-development-only'}`).digest();
}
export function encryptToken(token:string) {
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
 const data=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${data.toString('base64url')}`;
}
export function decryptToken(value:string) {
 const [version,iv,tag,data]=value.split('.');
 if(version!=='v1'||!iv||!tag||!data)throw new Error('The stored GoHighLevel token could not be read.');
 try {
  const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8');
 } catch {throw new Error('The stored GoHighLevel token could not be read. Re-enter it.');}
}
