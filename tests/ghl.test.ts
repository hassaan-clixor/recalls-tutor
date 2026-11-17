import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {embeddedDatabase} from '../lib/db/client';
import {migrate} from '../lib/db/migrate';
import {seedCatalogue} from '../lib/db/seed';
import {listExams} from '../lib/services/catalogue';
import {backfillGhl,checkGhlConnection,collectGhlEvents,createGhlConnection,deliverGhlEvents,listGhlConnections,listGhlLog,retryGhlEvent,runGhlSync,updateGhlConnection,type ClientFactory} from '../lib/services/ghl';
import {decryptToken,encryptToken,ghlClient,GhlRejectedError,GhlUnavailableError,type GhlClient,type GhlContactInput,type GhlOpportunityInput} from '../lib/integrations/ghl';
const TOKEN='pit-0000000000000000000000000000test';
test('GoHighLevel: encrypted tokens, idempotent events, tags and fields, opportunities, outage replay, retries and backfill',async()=>{
 const db=embeddedDatabase(new PGlite());
 try {
  await migrate(db);await seedCatalogue(db);
  const exams=await listExams(db),exam=exams[0],other=exams[1];
  async function account(role:string,opts:{marketing?:boolean;verified?:boolean}={}) {
   const authId=randomUUID(),email=`${authId.slice(0,8)}@example.test`;
   await db.query('INSERT INTO auth_users(id,name,email,email_verified,two_factor_enabled,created_at,updated_at) VALUES($1,$2,$3,true,true,now(),now())',[authId,'Test Student',email]);
   const [u]=await db.query<{id:string}>(`INSERT INTO app_users(auth_id,role) VALUES($1,$2) RETURNING id`,[authId,role]);
   await db.query('INSERT INTO student_profiles(user_id,country,exam_ids,marketing_emails) VALUES($1,$2,$3,$4)',[u.id,'GB',[exam.id],opts.marketing??true]);
   return {id:u.id,email};
  }
  // A student who existed before the connection: only a backfill may send them.
  const early=await account('student');
  await new Promise(r=>setTimeout(r,20));
  const admin=await account('super_admin'),manager=await account('content_manager');
  await assert.rejects(createGhlConnection(db,manager.id,{name:'Main',locationId:'LOC12345678',token:TOKEN,examId:null}),/Super Admin/);
  await assert.rejects(createGhlConnection(db,admin.id,{name:'Main',locationId:'bad id',token:TOKEN,examId:null}),/location/);
  await assert.rejects(createGhlConnection(db,admin.id,{name:'Main',locationId:'LOC12345678',token:'short',examId:null}),/token/);
  const connId=await createGhlConnection(db,admin.id,{name:'Main',locationId:'LOC12345678',token:TOKEN,examId:null});
  await assert.rejects(createGhlConnection(db,admin.id,{name:'Dup',locationId:'LOC12345678',token:TOKEN,examId:null}),/already connected/);
  // The token is stored encrypted and never returned.
  const [raw]=await db.query<{token_enc:string}>('SELECT token_enc FROM ghl_connections WHERE id=$1',[connId]);
  assert.ok(!raw.token_enc.includes(TOKEN));assert.equal(decryptToken(raw.token_enc),TOKEN);
  assert.notEqual(encryptToken(TOKEN),encryptToken(TOKEN),'every encryption uses a fresh nonce');
  assert.throws(()=>decryptToken(raw.token_enc.slice(0,-3)+'AAA'),/could not be read/);
  assert.ok(!JSON.stringify(await listGhlConnections(db,admin.id)).includes(TOKEN));
  await updateGhlConnection(db,admin.id,connId,{fieldMap:{exam_part:'fieldExamPart1',marketing_consent:'fieldConsent1',country:'fieldCountry1'},
   pipelineMap:{purchase:{pipelineId:'pipe1',stageId:'stageWon1',status:'won'}}});
  await assert.rejects(updateGhlConnection(db,admin.id,connId,{fieldMap:{bogus:'abc'}}),/Unknown field/);
  await assert.rejects(updateGhlConnection(db,admin.id,connId,{tagMap:{signup:['has space']}}),/Tags for signup/);
  // A recording fake of the GHL API.
  const contacts:GhlContactInput[]=[],opps:GhlOpportunityInput[]=[];let mode:'ok'|'down'|'denied'='ok',checks=0;
  const factory:ClientFactory=(token,loc)=>{assert.equal(token,TOKEN);assert.equal(loc,'LOC12345678');return {
   async upsertContact(i){if(mode==='down')throw new GhlUnavailableError('GoHighLevel answered 503.');if(mode==='denied')throw new GhlRejectedError('GoHighLevel rejected the access token or its scopes.',401);contacts.push(i);return {id:`contact-${i.email}`,isNew:true};},
   async upsertOpportunity(i){opps.push(i);return {id:'opp1'};},
   async checkConnection(){checks++;if(mode!=='ok')throw new GhlRejectedError('GoHighLevel rejected the access token or its scopes.',401);},
  } satisfies GhlClient;};
  const student=await account('student',{marketing:false});
  // Outage: the event is queued and retried; signup itself already succeeded, nothing here can throw into it.
  mode='down';
  assert.ok((await collectGhlEvents(db))>=1);
  const down=await deliverGhlEvents(db,{factory});
  assert.equal(down.delivered,0);assert.ok(down.retrying>=1);
  const [queued]=await db.query<{status:string;attempts:number;next_attempt_at:string}>(`SELECT status,attempts,next_attempt_at FROM ghl_sync_events WHERE user_id=$1 AND event='signup'`,[student.id]);
  assert.equal(queued.status,'pending');assert.equal(queued.attempts,1);assert.ok(new Date(queued.next_attempt_at)>new Date());
  assert.equal(contacts.length,0);
  // Recovery: once GHL is back and the backoff has passed, the same event is delivered; nothing is lost or duplicated.
  mode='ok';await db.query(`UPDATE ghl_sync_events SET next_attempt_at=now() WHERE status='pending'`);
  const up=await runGhlSync(db,{factory});
  assert.ok(up&&up.delivered>=1);
  const mine=contacts.find(c=>c.email===student.email)!;
  assert.ok(mine);assert.ok(mine.tags.includes('rt-signup'));assert.ok(mine.tags.includes(`rt-${(await db.query<{slug:string}>('SELECT slug FROM exams WHERE id=$1',[exam.id]))[0].slug}`));
  assert.ok(mine.tags.includes('rt-no-marketing-consent'),'a contact without consent is marked');
  // Only mapped fields are sent, and no question content or free text appears.
  assert.deepEqual(mine.customFields.map(f=>f.id).sort(),['fieldConsent1','fieldCountry1','fieldExamPart1']);
  assert.equal(mine.customFields.find(f=>f.id==='fieldConsent1')!.field_value,'No');
  // Idempotent: scanning again creates nothing new and sends nothing.
  const before=contacts.length;
  assert.equal(await collectGhlEvents(db),0);await deliverGhlEvents(db,{factory});assert.equal(contacts.length,before);
  // The student who existed before the connection was not sent.
  assert.ok(!contacts.some(c=>c.email===early.email));
  // Purchase: tags with exam and plan length, opportunity moved to the mapped stage as won.
  const [plan]=await db.query<{id:string}>(`INSERT INTO plans(exam_id,months,price_cents,stripe_price_id,active) VALUES($1,6,4500,'price_test_1',true) RETURNING id`,[exam.id]);
  await db.query(`INSERT INTO subscriptions(user_id,exam_id,plan_id,stripe_subscription_id,stripe_customer_id,status,current_period_start,current_period_end) VALUES($1,$2,$3,'sub_test_1','cus_test_1','active',now(),now()+interval '6 months')`,[student.id,exam.id,plan.id]);
  await db.query(`INSERT INTO billing_payments(stripe_invoice_id,user_id,exam_id,plan_id,kind,amount_cents,paid_at) VALUES('in_test_1',$1,$2,$3,'new',4500,now())`,[student.id,exam.id,plan.id]);
  await runGhlSync(db,{factory});
  const paid=contacts.filter(c=>c.email===student.email).at(-1)!;
  assert.ok(paid.tags.some(t=>/^rt-paid-.+-6m$/.test(t)),`purchase tag, got ${paid.tags}`);
  assert.equal(opps.length,1);assert.equal(opps[0].status,'won');assert.equal(opps[0].pipelineStageId,'stageWon1');assert.equal(opps[0].contactId,`contact-${student.email}`);
  // A rejected token fails at once (no endless retry), is visible in the log, and can be retried by hand.
  mode='denied';
  const second=await account('student');
  await runGhlSync(db,{factory});
  const failed=(await listGhlLog(db,admin.id,{status:'failed'})).find(r=>r.email===second.email)!;
  assert.ok(failed);assert.match(failed.lastError!,/rejected the access token/);
  assert.equal((await listGhlConnections(db,admin.id))[0].failed,1);
  assert.deepEqual(await checkGhlConnection(db,connId,factory),{ok:false,error:'GoHighLevel rejected the access token or its scopes.'});
  mode='ok';
  await retryGhlEvent(db,admin.id,failed.id);
  await assert.rejects(retryGhlEvent(db,admin.id,failed.id),/Only failed/);
  await deliverGhlEvents(db,{factory});
  assert.ok(contacts.some(c=>c.email===second.email));
  assert.deepEqual(await checkGhlConnection(db,connId,factory),{ok:true});
  assert.equal((await listGhlConnections(db,admin.id))[0].lastError,null);
  // Event toggles: a disabled event is never created.
  await updateGhlConnection(db,admin.id,connId,{events:['purchase']});
  await account('student');
  assert.equal(await collectGhlEvents(db),0);
  // Backfill sends students that existed before the connection (once), including the earlier one.
  await updateGhlConnection(db,admin.id,connId,{events:['signup','purchase','backfill']});
  assert.ok(await backfillGhl(db,admin.id,connId)>=1);
  assert.equal(await backfillGhl(db,admin.id,connId),0,'a second backfill adds nothing');
  await assert.rejects(backfillGhl(db,manager.id,connId),/Super Admin/);
  await deliverGhlEvents(db,{factory,limit:100});
  assert.ok(contacts.some(c=>c.email===early.email&&c.tags.includes('rt-synced')));
  // An exam-scoped connection only receives events for its own exam.
  const scoped=await createGhlConnection(db,admin.id,{name:'Other exam',locationId:'LOC87654321',token:TOKEN,examId:other.id});
  const sc=await db.query<{n:number}>(`SELECT count(*)::int AS n FROM ghl_sync_events WHERE connection_id=$1`,[scoped]);
  assert.equal(sc[0].n,0);
  // A deleted account is skipped, never sent.
  const gone=await account('student');
  await collectGhlEvents(db).catch(()=>0);
  await db.query(`UPDATE app_users SET status='deleted' WHERE id=$1`,[gone.id]);
  await deliverGhlEvents(db,{factory,limit:100});
  assert.ok(!contacts.some(c=>c.email===gone.email));
 } finally {await db.close();}
});
test('GoHighLevel client: fixed host, headers, retryable and permanent errors, no token in messages',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const reply=(status:number,body:unknown,headers:Record<string,string>={})=>(async(url:string|URL|Request,init?:RequestInit)=>{calls.push({url:String(url),init:init??{}});return new Response(JSON.stringify(body),{status,headers});}) as typeof fetch;
 const ok=ghlClient(TOKEN,'LOC12345678',reply(200,{contact:{id:'c1'},new:true}));
 assert.deepEqual(await ok.upsertContact({email:'a@b.test',tags:['x'],customFields:[]}),{id:'c1',isNew:true});
 assert.equal(calls[0].url,'https://services.leadconnectorhq.com/contacts/upsert');
 const headers=calls[0].init.headers as Record<string,string>;
 assert.equal(headers.Authorization,`Bearer ${TOKEN}`);assert.equal(headers.Version,'2021-07-28');
 assert.equal(JSON.parse(calls[0].init.body as string).locationId,'LOC12345678');
 await assert.rejects(ghlClient(TOKEN,'LOC12345678',reply(429,{},{'retry-after':'120'})).upsertContact({email:'a@b.test',tags:[],customFields:[]}),(e:unknown)=>e instanceof GhlUnavailableError&&e.retryAfterSeconds===120);
 await assert.rejects(ghlClient(TOKEN,'LOC12345678',reply(503,{})).upsertContact({email:'a@b.test',tags:[],customFields:[]}),GhlUnavailableError);
 await assert.rejects(ghlClient(TOKEN,'LOC12345678',(async()=>{throw new TypeError('fetch failed');}) as typeof fetch).upsertContact({email:'a@b.test',tags:[],customFields:[]}),GhlUnavailableError);
 for(const status of [401,403,422]){
  await assert.rejects(ghlClient(TOKEN,'LOC12345678',reply(status,{})).upsertContact({email:'a@b.test',tags:[],customFields:[]}),(e:unknown)=>e instanceof GhlRejectedError&&e.status===status&&!e.message.includes(TOKEN));
 }
 await assert.rejects(ghlClient(TOKEN,'LOC12345678',reply(200,{})).upsertContact({email:'a@b.test',tags:[],customFields:[]}),/contact id/);
});
