import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {embeddedDatabase} from '../lib/db/client';
import {migrate} from '../lib/db/migrate';
import {createAuth} from '../lib/auth/server';
import {actorFromSession} from '../lib/auth/actor';
import type {AuthMail} from '../lib/auth/mail';
test('A student signing in on a new device ends the older session; staff sessions are not limited',async()=>{
 const db=embeddedDatabase(new PGlite());
 const messages:AuthMail[]=[];const origin='http://localhost:3000';
 const auth=createAuth(db,{secret:randomBytes(48).toString('base64url'),baseURL:origin,sendMail:async m=>{messages.push(m);},rateLimit:false});
 const jars=[new Map<string,string>(),new Map<string,string>(),new Map<string,string>()];
 async function call(jar:Map<string,string>,path:string,body?:unknown) {
  const response=await auth.handler(new Request(new URL(`/api/auth${path}`,origin),{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0];const i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
  const text=await response.text();return {status:response.status,data:text?JSON.parse(text):null};
 }
 try {
  await migrate(db);
  const password='A-test-password-827!';
  await call(jars[0],'/sign-up/email',{name:'Share Test',email:'share@example.test',password,callbackURL:'/dashboard'});
  await auth.handler(new Request(messages[0].text.match(/https?:\/\/\S+/)![0]));
  assert.equal((await call(jars[0],'/sign-in/email',{email:'share@example.test',password})).status,200);
  const first=(await call(jars[0],'/get-session')).data;assert.ok(first);
  const actor=(await actorFromSession(db,first))!;assert.equal(actor.role,'student');
  // A second device signs in: the first is signed out, the second works.
  assert.equal((await call(jars[1],'/sign-in/email',{email:'share@example.test',password})).status,200);
  assert.equal((await call(jars[0],'/get-session')).data,null,'the older session ended');
  assert.ok((await call(jars[1],'/get-session')).data);
  assert.equal((await db.query(`SELECT 1 FROM auth_sessions WHERE user_id=$1`,[actor.authId])).length,1);
  // Staff are not limited: two concurrent sessions both stay valid.
  await db.query(`UPDATE app_users SET role='content_manager' WHERE id=$1`,[actor.id]);
  assert.equal((await call(jars[0],'/sign-in/email',{email:'share@example.test',password})).status,200);
  assert.equal((await call(jars[2],'/sign-in/email',{email:'share@example.test',password})).status,200);
  assert.ok((await call(jars[0],'/get-session')).data);assert.ok((await call(jars[2],'/get-session')).data);
 } finally {await db.close();}
});
