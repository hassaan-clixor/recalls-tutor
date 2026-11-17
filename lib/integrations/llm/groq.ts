import type {RecallModel} from './claude-cli';
import {ModelUnavailableError,readProviderJson,retryAfterSeconds} from './fallback';
import {strictSchema} from './openai';

// Only models that support Groq strict structured output are suitable for this adapter.
export function groqRecallModel(model:string,apiKey:string,fetcher:typeof fetch=fetch):RecallModel {
 return {name:`groq:${model}`,async complete(request) {
  let response:Response;const signal=AbortSignal.timeout(request.timeoutMs??120000);
  try {response=await fetcher('https://api.groq.com/openai/v1/chat/completions',{
   method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
   body:JSON.stringify({model,messages:[{role:'system',content:request.system},{role:'user',content:request.prompt}],
    response_format:{type:'json_schema',json_schema:{name:'recalls_tutor_output',strict:true,schema:strictSchema(request.schema)}}}),
   signal,
  });} catch {throw new ModelUnavailableError('Groq is temporarily unavailable.');}
  if(response.status===429||response.status===402||response.status>=500)throw new ModelUnavailableError('Groq is temporarily unavailable.',retryAfterSeconds(response.headers.get('retry-after')));
  if(!response.ok)throw new Error('The Groq request was rejected. Check model support and API configuration.');
  const body=await readProviderJson(response,'Groq',signal) as {model?:string;choices?:{finish_reason?:string;message?:{content?:string;refusal?:string}}[]};
  const choice=body.choices?.[0];
  if(choice?.message?.refusal)throw new Error('The AI model declined this request.');
  if(choice?.finish_reason!=='stop')throw new Error('The AI response was incomplete.');
  let output:unknown;try{output=JSON.parse(choice.message?.content??'');}catch{throw new Error('The AI model returned invalid structured output.');}
  return {output,model:`groq:${body.model||model}`,costUsd:null};
 }};
}
