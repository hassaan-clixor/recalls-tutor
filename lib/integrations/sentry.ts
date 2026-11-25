import {randomUUID} from 'node:crypto';

// Error tracking without an SDK: when SENTRY_DSN is set, unhandled server errors are posted to Sentry's envelope
// endpoint. Only the error, its stack, the route and the HTTP method are sent. Never query strings, cookies, headers or bodies.
function parse(dsn:string){try{const u=new URL(dsn);const project=u.pathname.replace(/^\//,'');return u.username&&project?{key:u.username,envelope:`${u.protocol}//${u.host}/api/${project}/envelope/`}:null;}catch{return null;}}
export const sentryConfigured=()=>Boolean(process.env.SENTRY_DSN&&parse(process.env.SENTRY_DSN));
export async function reportError(error:unknown,context:{path?:string;method?:string;route?:string}={}) {
 const dsn=process.env.SENTRY_DSN;const target=dsn?parse(dsn):null;if(!dsn||!target)return;
 const err=error instanceof Error?error:new Error(String(error));
 const event={event_id:randomUUID().replace(/-/g,''),timestamp:Date.now()/1000,platform:'node',level:'error',environment:process.env.VERCEL_ENV||process.env.NODE_ENV,release:process.env.VERCEL_GIT_COMMIT_SHA,
  exception:{values:[{type:err.name,value:err.message.slice(0,500),stacktrace:{frames:(err.stack??'').split('\n').slice(1,30).reverse().map(l=>({filename:l.trim().slice(0,300)}))}}]},
  tags:{route:context.route??'',method:context.method??''},request:{url:(context.path??'').split('?')[0],method:context.method}};
 const body=`${JSON.stringify({event_id:event.event_id,dsn})}\n${JSON.stringify({type:'event'})}\n${JSON.stringify(event)}`;
 try{await fetch(target.envelope,{method:'POST',headers:{'Content-Type':'application/x-sentry-envelope','X-Sentry-Auth':`Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=recalls-tutor/1`},body,signal:AbortSignal.timeout(4000)});}catch{/* reporting must never break a request */}
}
