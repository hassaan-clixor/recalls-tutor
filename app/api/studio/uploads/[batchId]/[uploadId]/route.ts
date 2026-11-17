import {configuredStorage,validLocalToken} from '@/lib/integrations/storage';
import {MAX_DOCUMENT_BYTES} from '@/lib/services/upload-batches';
export const dynamic='force-dynamic';
type Context={params:Promise<{batchId:string;uploadId:string}>};
// Development only: stands in for the object-storage signed URL when no STORAGE_* variables are set. A deployed
// server always uses real storage, so this route refuses to run in production.
export async function PUT(request:Request,{params}:Context) {
 const storage=configuredStorage();
 if(process.env.NODE_ENV==='production'||!storage||storage.kind!=='local'||!('write' in storage))return Response.json({error:'Not available.'},{status:404});
 const {batchId,uploadId}=await params,url=new URL(request.url);
 const key=`uploads/${batchId}/${uploadId}`,expires=Number(url.searchParams.get('expires')),token=url.searchParams.get('token')??'';
 if(!/^[0-9a-f-]{36}$/.test(batchId)||!/^[0-9a-f-]{36}$/.test(uploadId)||!validLocalToken(process.env.BETTER_AUTH_SECRET||'local-development-only',key,expires,token))return Response.json({error:'This upload link is not valid or has expired.'},{status:403});
 const length=Number(request.headers.get('content-length'));
 if(!Number.isFinite(length)||length<1||length>MAX_DOCUMENT_BYTES)return Response.json({error:'The file size is not allowed.'},{status:413});
 await (storage as {write(key:string,bytes:Uint8Array):Promise<void>}).write(key,new Uint8Array(await request.arrayBuffer()));
 return new Response(null,{status:200});
}
