import type {RecallModel} from './claude-cli';
import {ModelUnavailableError,readProviderJson,retryAfterSeconds} from './fallback';

// The Responses API receives no tools and does not store responses. Schema constraints are also checked downstream.
export function strictSchema(input:unknown):unknown {
 if(Array.isArray(input))return input.map(strictSchema);
 if(!input||typeof input!=='object')return input;
 const result:Record<string,unknown>={};
 for(const [key,value] of Object.entries(input)) {
  // Keep compatibility with the common Structured Outputs subset; server-side validation remains authoritative.
  if(['minimum','maximum','minItems','maxItems'].includes(key))continue;
  result[key]=strictSchema(value);
 }
 return result;
}
export function openaiRecallModel(model:string,apiKey:string,fetcher:typeof fetch=fetch):RecallModel {
 return {name:`openai:${model}`,async complete(request) {
  let response:Response;const signal=AbortSignal.timeout(request.timeoutMs??120000);
  try {response=await fetcher('https://api.openai.com/v1/responses',{
   method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
   body:JSON.stringify({model,store:false,instructions:request.system,input:request.prompt,
    text:{format:{type:'json_schema',name:'recalls_tutor_output',strict:true,schema:strictSchema(request.schema)}}}),
   signal,
  });}catch {throw new ModelUnavailableError('OpenAI is temporarily unavailable.');}
  if(response.status===429||response.status===402||response.status>=500)throw new ModelUnavailableError('OpenAI is temporarily unavailable.',retryAfterSeconds(response.headers.get('retry-after')));
  if(!response.ok)throw new Error('The OpenAI request was rejected. Check the model and API configuration.');
  const body=await readProviderJson(response,'OpenAI',signal) as {status?:string;model?:string;output?:{type?:string;content?:{type?:string;text?:string}[]}[]};
  if(body.status!=='completed')throw new Error('The AI response was incomplete.');
  const content=(body.output??[]).flatMap(item=>item.content??[]);
  if(content.some(item=>item.type==='refusal'))throw new Error('The AI model declined this request.');
  const text=content.filter(item=>item.type==='output_text').map(item=>item.text??'').join('');
  let output:unknown;try{output=JSON.parse(text);}catch{throw new Error('The AI model returned invalid structured output.');}
  return {output,model:`openai:${body.model||model}`,costUsd:null};
 }};
}
