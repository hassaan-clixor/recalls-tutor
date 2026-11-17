import type {RecallModel} from './claude-cli';
import {ModelUnavailableError,readProviderJson,retryAfterSeconds} from './fallback';
import {strictSchema} from './openai';

// The Gemini endpoint is fixed: provider configuration cannot redirect private prompts to arbitrary hosts.
export function geminiRecallModel(model:string,apiKey:string,fetcher:typeof fetch=fetch):RecallModel {
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model))throw new Error('Invalid Gemini model ID.');
 return {name:`gemini:${model}`,async complete(request) {
  let response:Response;const signal=AbortSignal.timeout(request.timeoutMs??120000);
  try {response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
   method:'POST',headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
   body:JSON.stringify({systemInstruction:{parts:[{text:request.system}]},contents:[{role:'user',parts:[{text:request.prompt}]}],
    generationConfig:{responseMimeType:'application/json',responseJsonSchema:strictSchema(request.schema)}}),
   signal,
  });} catch {throw new ModelUnavailableError('Gemini is temporarily unavailable.');}
  if(response.status===429||response.status===402||response.status>=500)throw new ModelUnavailableError('Gemini is temporarily unavailable.',retryAfterSeconds(response.headers.get('retry-after')));
  if(!response.ok)throw new Error('The Gemini request was rejected. Check model support and API configuration.');
  const body=await readProviderJson(response,'Gemini',signal) as {modelVersion?:string;promptFeedback?:{blockReason?:string};candidates?:{finishReason?:string;content?:{parts?:{text?:string;thought?:boolean}[]}}[]};
  if(body.promptFeedback?.blockReason)throw new Error('The AI model declined this request.');
  const candidate=body.candidates?.[0];
  if(candidate?.finishReason==='SAFETY'||candidate?.finishReason==='RECITATION')throw new Error('The AI model declined this request.');
  if(candidate?.finishReason!=='STOP')throw new Error('The AI response was incomplete.');
  const text=(candidate.content?.parts??[]).filter(p=>!p.thought).map(p=>p.text??'').join('');
  let output:unknown;try{output=JSON.parse(text);}catch{throw new Error('The AI model returned invalid structured output.');}
  return {output,model:`gemini:${body.modelVersion||model}`,costUsd:null};
 }};
}
