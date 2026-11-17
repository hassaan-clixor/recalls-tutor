import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,rm,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
// Private object storage for large Studio uploads (PRD 4.1: up to 500 MB per batch). Browsers send files straight to
// storage with a short-lived signed URL, so the web function never has to hold a request body larger than a few KB.
// Works with any S3-compatible service (AWS S3, Cloudflare R2, Supabase Storage S3 endpoint). The same signing code
// is used for downloads and deletes made by the server.
export interface UploadStorage {
 readonly kind:'s3'|'local';
 uploadUrl(key:string,expiresSeconds:number):Promise<{url:string;method:'PUT'}>;
 size(key:string):Promise<number|null>;
 read(key:string):Promise<Uint8Array>;
 remove(key:string):Promise<void>;
}
export type S3Config={endpoint:string;region:string;bucket:string;accessKeyId:string;secretAccessKey:string;pathStyle:boolean};
const enc=(v:string)=>encodeURIComponent(v).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const hmac=(key:Buffer|string,data:string)=>createHmac('sha256',key).update(data).digest();
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
// AWS Signature Version 4, query-string form. Only the host header is signed so any client can send the body.
export function presign(config:S3Config,method:'GET'|'PUT'|'DELETE'|'HEAD',key:string,expiresSeconds:number,now=new Date()) {
 const endpoint=new URL(config.endpoint);
 const host=config.pathStyle?endpoint.host:`${config.bucket}.${endpoint.host}`;
 const objectPath=(config.pathStyle?`/${config.bucket}/`:'/')+key.split('/').map(enc).join('/');
 const stamp=now.toISOString().replace(/[:-]|\.\d{3}/g,''),date=stamp.slice(0,8),scope=`${date}/${config.region}/s3/aws4_request`;
 const params:[string,string][]=[['X-Amz-Algorithm','AWS4-HMAC-SHA256'],['X-Amz-Credential',`${config.accessKeyId}/${scope}`],['X-Amz-Date',stamp],['X-Amz-Expires',String(expiresSeconds)],['X-Amz-SignedHeaders','host']];
 const query=params.map(([k,v])=>`${enc(k)}=${enc(v)}`).sort().join('&');
 const canonical=[method,objectPath,query,`host:${host}\n`,'host','UNSIGNED-PAYLOAD'].join('\n');
 const toSign=['AWS4-HMAC-SHA256',stamp,scope,sha(canonical)].join('\n');
 const signingKey=hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`,date),config.region),'s3'),'aws4_request');
 const signature=createHmac('sha256',signingKey).update(toSign).digest('hex');
 return `${endpoint.protocol}//${host}${objectPath}?${query}&X-Amz-Signature=${signature}`;
}
export function s3Storage(config:S3Config,fetcher:typeof fetch=fetch):UploadStorage {
 const url=(method:'GET'|'PUT'|'DELETE'|'HEAD',key:string,expires=900)=>presign(config,method,key,expires);
 return {
  kind:'s3',
  async uploadUrl(key,expiresSeconds){return {url:url('PUT',key,expiresSeconds),method:'PUT'};},
  async size(key){
   const r=await fetcher(url('HEAD',key),{method:'HEAD',signal:AbortSignal.timeout(15000)});
   if(r.status===404)return null;if(!r.ok)throw new Error('The storage service could not be reached.');
   const n=Number(r.headers.get('content-length'));return Number.isFinite(n)?n:null;
  },
  async read(key){
   const r=await fetcher(url('GET',key),{signal:AbortSignal.timeout(120000)});
   if(!r.ok)throw new Error('The uploaded file could not be read from storage.');
   return new Uint8Array(await r.arrayBuffer());
  },
  async remove(key){const r=await fetcher(url('DELETE',key),{method:'DELETE',signal:AbortSignal.timeout(15000)});if(!r.ok&&r.status!==404)throw new Error('The uploaded file could not be deleted from storage.');},
 };
}
// Development and tests: files live under .local/uploads and are written through a signed route of this app.
export function localToken(secret:string,key:string,expires:number) {return createHmac('sha256',secret).update(`upload:${key}:${expires}`).digest('base64url');}
export function validLocalToken(secret:string,key:string,expires:number,token:string) {
 if(!Number.isFinite(expires)||expires<Date.now()/1000)return false;
 const expected=localToken(secret,key,expires);
 return token.length===expected.length&&timingSafeEqual(Buffer.from(token),Buffer.from(expected));
}
const KEY=/^uploads\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/;
export function localStorageAdapter(options:{root?:string;secret:string;baseUrl:string}):UploadStorage&{write(key:string,bytes:Uint8Array):Promise<void>} {
 const root=options.root??path.join(process.cwd(),'.local/uploads');
 const file=(key:string)=>{if(!KEY.test(key))throw new Error('Invalid storage key.');return path.join(root,key.slice('uploads/'.length).replace('/','__'));};
 return {
  kind:'local',
  async uploadUrl(key,expiresSeconds){
   file(key);const expires=Math.floor(Date.now()/1000)+expiresSeconds;
   return {url:`${options.baseUrl}/api/studio/uploads/${key.slice('uploads/'.length)}?expires=${expires}&token=${localToken(options.secret,key,expires)}`,method:'PUT'};
  },
  async size(key){try{return (await stat(file(key))).size;}catch{return null;}},
  async read(key){return new Uint8Array(await readFile(file(key)));},
  async remove(key){await rm(file(key),{force:true});},
  async write(key,bytes){const f=file(key);await mkdir(path.dirname(f),{recursive:true});await writeFile(f,bytes);},
 };
}
export function configuredStorage():UploadStorage|null {
 const e=process.env;
 if(e.STORAGE_ENDPOINT&&e.STORAGE_BUCKET&&e.STORAGE_ACCESS_KEY_ID&&e.STORAGE_SECRET_ACCESS_KEY){
  if(!e.STORAGE_ENDPOINT.startsWith('https://'))throw new Error('STORAGE_ENDPOINT must use https://.');
  return s3Storage({endpoint:e.STORAGE_ENDPOINT,region:e.STORAGE_REGION||'auto',bucket:e.STORAGE_BUCKET,accessKeyId:e.STORAGE_ACCESS_KEY_ID,secretAccessKey:e.STORAGE_SECRET_ACCESS_KEY,pathStyle:e.STORAGE_PATH_STYLE!=='false'});
 }
 // Without storage credentials only a local, non-production server may accept large uploads (it keeps files on disk).
 if(process.env.NODE_ENV==='production')return null;
 return localStorageAdapter({secret:e.BETTER_AUTH_SECRET||'local-development-only',baseUrl:e.BETTER_AUTH_URL||'http://127.0.0.1:3000'});
}
