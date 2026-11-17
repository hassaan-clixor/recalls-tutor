import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fallbackModel,ModelUnavailableError,parseModelChain,parseRateLimits,retryAfterSeconds} from '../lib/integrations/llm/fallback';
import {databaseCooldowns,databaseRateLimits} from '../lib/integrations/llm/cooldowns';
import {embeddedDatabase} from '../lib/db/client';
import {migrate} from '../lib/db/migrate';
import {PGlite} from '@electric-sql/pglite';
import {openaiRecallModel} from '../lib/integrations/llm/openai';
import {groqRecallModel} from '../lib/integrations/llm/groq';
import {geminiRecallModel} from '../lib/integrations/llm/gemini';
import {anthropicRecallModel} from '../lib/integrations/llm/anthropic';
import Anthropic from '@anthropic-ai/sdk';
import type {RecallModel} from '../lib/integrations/llm/claude-cli';
const req={system:'Return JSON',prompt:'Synthetic test',schema:{type:'object',additionalProperties:false,required:['answer'],properties:{answer:{type:'string'}}}};
test('Anthropic uses the configured model without provider-side refusal fallback',async()=>{
 let sent:Record<string,unknown>|undefined;
 const client={beta:{messages:{stream(request:Record<string,unknown>){sent=request;return {async finalMessage(){return {stop_reason:'refusal',content:[],model:'chosen-model',usage:{input_tokens:0,output_tokens:0}};}};}}}} as unknown as Anthropic;
 const chain=fallbackModel([anthropicRecallModel(client,'medium','chosen-model'),{name:'second',async complete(){throw new Error('must not run');}}]);
 await assert.rejects(chain.complete(req),/declined/);
 assert.equal(sent?.model,'chosen-model');assert.equal(sent?.fallbacks,undefined);assert.equal(sent?.betas,undefined);
});
test('Anthropic rate limits respect a bounded provider retry delay',async()=>{
 const client={beta:{messages:{stream(){return {async finalMessage(){throw new Anthropic.RateLimitError(429,{},'limited',new Headers({'retry-after':'45'}));}};}}}} as unknown as Anthropic;
 await assert.rejects(anthropicRecallModel(client,'medium','chosen-model').complete(req),(error:unknown)=>error instanceof ModelUnavailableError&&error.retryAfterSeconds===45);
});
test('model chain changes provider on quota or service failure, and preserves selected model',async()=>{
 const calls:string[]=[];
 const bad:RecallModel={name:'first',async complete(){calls.push('first');throw new ModelUnavailableError('quota');}};
 const good:RecallModel={name:'second',async complete(request){calls.push('second');assert.equal(request.prompt,req.prompt);assert.ok(request.timeoutMs&&request.timeoutMs<=120000);return {output:{answer:'ok'},model:'second',costUsd:null};}};
 const result=await fallbackModel([bad,good]).complete(req);
 assert.equal(result.model,'second');assert.deepEqual(calls,['first','second']);
});
test('a timed-out provider is aborted and the next model receives remaining time',async()=>{
 let aborted=false,secondBudget=0;
 const slow:typeof fetch=async(_url,options)=>new Promise((_resolve,reject)=>{
  options?.signal?.addEventListener('abort',()=>{aborted=true;reject(new Error('timeout'));},{once:true});
 });
 const second:RecallModel={name:'second',async complete(request){secondBudget=request.timeoutMs??0;return {output:{answer:'ok'},model:'second',costUsd:null};}};
 const result=await fallbackModel([openaiRecallModel('example','key',slow),second]).complete({...req,timeoutMs:4000});
 assert.equal(result.model,'second');assert.equal(aborted,true);assert.ok(secondBudget>=1000&&secondBudget<=2000);
});
test('response-body interruption falls back, while malformed provider JSON does not',async()=>{
 const interrupted:typeof fetch=async(_url,options)=>new Response(new ReadableStream({start(controller){
  options?.signal?.addEventListener('abort',()=>controller.error(new DOMException('aborted','AbortError')),{once:true});
 }}),{status:200});
 for(const model of [openaiRecallModel('example','key',interrupted),groqRecallModel('example','key',interrupted),geminiRecallModel('example','key',interrupted)]){
  let reached=false;const next:RecallModel={name:'next',async complete(){reached=true;return {output:{},model:'next',costUsd:null};}};
  await fallbackModel([model,next]).complete({...req,timeoutMs:3000});assert.equal(reached,true);
 }
 const invalid:typeof fetch=async()=>new Response('{invalid',{status:200});let reached=false;
 const next:RecallModel={name:'next',async complete(){reached=true;return {output:{},model:'next',costUsd:null};}};
 await assert.rejects(fallbackModel([openaiRecallModel('example','key',invalid),next]).complete(req),/invalid response/);assert.equal(reached,false);
});
test('shared cooldown skips a failed model until it expires',async()=>{
 const db=embeddedDatabase(new PGlite());try{
  await migrate(db);const cooldowns=databaseCooldowns(db),calls:string[]=[];
  const first:RecallModel={name:'first',async complete(){calls.push('first');throw new ModelUnavailableError('rate limited',60);}};
  const second:RecallModel={name:'second',async complete(){calls.push('second');return {output:{},model:'second',costUsd:null};}};
  const chain=fallbackModel([first,second],cooldowns);
  await chain.complete(req);await chain.complete(req);assert.deepEqual(calls,['first','second','second']);
  await db.query("UPDATE llm_model_cooldowns SET unavailable_until=now()-interval '1 second' WHERE model_name='first'");
  await chain.complete(req);assert.deepEqual(calls,['first','second','second','first','second']);
  assert.equal(retryAfterSeconds('120'),120);assert.equal(retryAfterSeconds('900'),600);assert.equal(retryAfterSeconds('invalid'),30);
 }finally{await db.close();}
});
test('cooldown storage failure does not prevent a healthy model from responding',async()=>{
 const good:RecallModel={name:'good',async complete(){return {output:{},model:'good',costUsd:null};}};
 const result=await fallbackModel([good],{async isCooling(){throw new Error('database unavailable');},async markUnavailable(){throw new Error('database unavailable');}}).complete(req);
 assert.equal(result.model,'good');
});
test('shared per-model request limits route to the next model and reset',async()=>{
 const db=embeddedDatabase(new PGlite());try{
  await migrate(db);const calls:string[]=[];
  const model=(name:string):RecallModel=>({name,async complete(){calls.push(name);return {output:{},model:name,costUsd:null};}});
  const limiter=databaseRateLimits(db,new Map([['first',1],['second',2]]));const chain=fallbackModel([model('first'),model('second')],undefined,limiter);
  assert.equal((await chain.complete(req)).model,'first');assert.equal((await chain.complete(req)).model,'second');assert.equal((await chain.complete(req)).model,'second');
  await assert.rejects(chain.complete(req),/All configured/);assert.deepEqual(calls,['first','second','second']);
  await db.query("UPDATE llm_model_rate_limits SET window_started_at=now()-interval '2 minutes'");
  assert.equal((await chain.complete(req)).model,'first');
  await assert.rejects(fallbackModel([model('first')],undefined,{async acquire(){throw new Error('limiter unavailable');}}).complete(req),/limiter unavailable/);
 }finally{await db.close();}
});
test('rate configuration only accepts positive limits for configured models',()=>{
 const specs=parseModelChain('openai:a,groq:b');assert.equal(parseRateLimits('openai:a=10,groq:b=2',specs).get('openai:a'),10);
 for(const input of ['openai:a=0','openai:b=1','openai:a=3,openai:a=4','openai:a=-1','openai:a=1,'])assert.throws(()=>parseRateLimits(input,specs));
});
test('model chain fails closed on refusal or malformed output; never tries another provider',async()=>{
 let tried=false;
 const refusal:RecallModel={name:'refusal',async complete(){throw new Error('refused');}};
 const other:RecallModel={name:'other',async complete(){tried=true;return {output:{},model:'other',costUsd:null};}};
 await assert.rejects(fallbackModel([refusal,other]).complete(req),/refused/);assert.equal(tried,false);
 await assert.rejects(fallbackModel([{name:'down',async complete(){throw new ModelUnavailableError('down');}}]).complete(req),/All configured/);
});
test('configuration accepts at most five explicit providers and rejects malformed entries',()=>{
 assert.equal(parseModelChain('anthropic:a,openai:b,groq:qwen/example,gemini:example').length,4);
 for(const input of ['', 'openai:a,openai:a','bogus:a','openai:a,','openai:a,openai:b,openai:c,openai:d,openai:e,openai:f'])assert.throws(()=>parseModelChain(input));
});
test('Gemini sends schema-constrained text and fails over only for availability errors',async()=>{
 let sent:Record<string,unknown>|undefined,endpoint='';
 const ok:typeof fetch=async (url,init)=>{endpoint=String(url);sent=JSON.parse(String(init?.body));return Response.json({modelVersion:'gemini-example',candidates:[{finishReason:'STOP',content:{parts:[{text:'{"answer":"ok"}'}]}}]});};
 const result=await geminiRecallModel('gemini-example','test-key',ok).complete(req);
 assert.equal(result.model,'gemini:gemini-example');assert.deepEqual(result.output,{answer:'ok'});
 assert.match(endpoint,/generativelanguage\.googleapis\.com/);
 assert.equal((sent?.generationConfig as {responseMimeType:string}).responseMimeType,'application/json');
 const rate:typeof fetch=async()=>new Response('',{status:429});
 await assert.rejects(geminiRecallModel('gemini-example','test-key',rate).complete(req),ModelUnavailableError);
 const refused:typeof fetch=async()=>Response.json({promptFeedback:{blockReason:'SAFETY'}});
 await assert.rejects(geminiRecallModel('gemini-example','test-key',refused).complete(req),/declined/);
 assert.throws(()=>geminiRecallModel('../example','test-key'));
});
test('Groq serves strict structured output and classifies rate limits for fallback',async()=>{
 let sent:Record<string,unknown>|undefined;
 const ok:typeof fetch=async (_url,init)=>{sent=JSON.parse(String(init?.body));return Response.json({model:'qwen/example',choices:[{finish_reason:'stop',message:{content:'{"answer":"ok"}'}}]});};
 const result=await groqRecallModel('qwen/example','test-key',ok).complete(req);
 assert.equal(result.model,'groq:qwen/example');assert.deepEqual(result.output,{answer:'ok'});
 assert.equal((sent?.response_format as {json_schema:{strict:boolean}}).json_schema.strict,true);
 const rate:typeof fetch=async()=>new Response('',{status:429});
 await assert.rejects(groqRecallModel('qwen/example','test-key',rate).complete(req),ModelUnavailableError);
});
test('OpenAI Responses adapter uses strict JSON, disables storage, and distinguishes quota from request rejection',async()=>{
 let requestBody:Record<string,unknown>|undefined;
 const ok:typeof fetch=async (_url,init)=>{requestBody=JSON.parse(String(init?.body));return Response.json({status:'completed',model:'example-model',output:[{type:'message',content:[{type:'output_text',text:'{"answer":"ok"}'}]}]});};
 const result=await openaiRecallModel('example-model','test-key',ok).complete(req);
 assert.equal(result.model,'openai:example-model');assert.deepEqual(result.output,{answer:'ok'});assert.equal(requestBody?.store,false);
 assert.equal(((requestBody?.text as {format:{strict:boolean}}).format).strict,true);
 const quota:typeof fetch=async()=>new Response('',{status:429});
 await assert.rejects(openaiRecallModel('example','test-key',quota).complete(req),ModelUnavailableError);
 const rejected:typeof fetch=async()=>new Response('',{status:400});
 await assert.rejects(openaiRecallModel('example','test-key',rejected).complete(req),/rejected/);
 const refused:typeof fetch=async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]});
 await assert.rejects(openaiRecallModel('example','test-key',refused).complete(req),/declined/);
});
