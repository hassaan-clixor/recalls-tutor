import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {embeddedDatabase} from '../lib/db/client';
import {migrate} from '../lib/db/migrate';
import {createAuth} from '../lib/auth/server';
import {actorFromSession} from '../lib/auth/actor';
import {demoNoEmail} from '../lib/auth/demo';
import type {AuthMail} from '../lib/auth/mail';
test('Demo switch: sign up and sign in with no email; a live Stripe key refuses the switch',async()=>{
 const before={demo:process.env.AUTH_DEMO_NO_EMAIL,stripe:process.env.STRIPE_SECRET_KEY};
 const db=embeddedDatabase(new PGlite());
 const messages:AuthMail[]=[];const origin='http://localhost:3000';
 try {
  process.env.AUTH_DEMO_NO_EMAIL='true';delete process.env.STRIPE_SECRET_KEY;
  assert.equal(demoNoEmail(),true);
  const auth=createAuth(db,{secret:randomBytes(48).toString('base64url'),baseURL:origin,sendMail:async m=>{messages.push(m);},rateLimit:false});
  const jar=new Map<string,string>();
  async function call(path:string,body?:unknown) {
   const response=await auth.handler(new Request(new URL(`/api/auth${path}`,origin),{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},...(body===undefined?{}:{body:JSON.stringify(body)})}));
   for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0];const i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
   const text=await response.text();return {status:response.status,data:text?JSON.parse(text):null};
  }
  await migrate(db);
  const password='A-demo-password-4821!';
  assert.equal((await call('/sign-up/email',{name:'Demo User',email:'demo@example.test',password,callbackURL:'/dashboard'})).status,200);
  assert.equal(messages.length,0,'no verification email is sent');
  assert.equal((await call('/sign-in/email',{email:'demo@example.test',password})).status,200,'sign-in works without verifying');
  const session=(await call('/get-session')).data;assert.ok(session);
  const actor=(await actorFromSession(db,session))!;
  assert.equal(actor.role,'student');assert.equal(actor.emailVerified,true,'the app treats the account as verified in demo mode');
  process.env.STRIPE_SECRET_KEY='sk_live_example';
  assert.throws(()=>demoNoEmail(),/live Stripe key/);
  delete process.env.AUTH_DEMO_NO_EMAIL;assert.equal(demoNoEmail(),false);
 } finally {
  if(before.demo===undefined)delete process.env.AUTH_DEMO_NO_EMAIL;else process.env.AUTH_DEMO_NO_EMAIL=before.demo;
  if(before.stripe===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=before.stripe;
  await db.close();
 }
});
