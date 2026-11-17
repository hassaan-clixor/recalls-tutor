import type {RecallModel,ModelRequest,ModelResponse} from './claude-cli';

// Only provider availability failures qualify. Refusals, invalid requests and invalid outputs stop the chain.
export class ModelUnavailableError extends Error {
 constructor(message:string,public retryAfterSeconds=30) {super(message);this.name='ModelUnavailableError';}
}
export interface CooldownStore {isCooling(model:string):Promise<boolean>;markUnavailable(model:string,seconds:number):Promise<void>}
export interface RateLimitStore {acquire(model:string):Promise<boolean>}
/** An interrupted response is an availability failure; invalid JSON must not bypass review safeguards. */
export async function readProviderJson(response:Response,provider:string,signal:AbortSignal):Promise<unknown> {
 try{return await response.json();}
 catch(error){
  if(signal.aborted||error instanceof TypeError)throw new ModelUnavailableError(`${provider} is temporarily unavailable.`);
  throw new Error('The AI provider returned an invalid response.');
 }
}
export function retryAfterSeconds(header:string|null,now=Date.now()):number {
 if(!header)return 30;
 const numeric=Number(header);const seconds=Number.isFinite(numeric)&&header.trim()!==''?numeric:(Date.parse(header)-now)/1000;
 return Number.isFinite(seconds)?Math.max(1,Math.min(600,Math.ceil(seconds))):30;
}
export function fallbackModel(models:RecallModel[],cooldowns?:CooldownStore,rateLimits?:RateLimitStore):RecallModel {
 if(models.length<1||models.length>5)throw new Error('Configure between one and five AI models.');
 return {name:'configured-model-chain',async complete(request:ModelRequest):Promise<ModelResponse>{
  const budget=request.timeoutMs??240000;
  if(!Number.isSafeInteger(budget)||budget<1000||budget>240000)throw new Error('Invalid AI request time budget.');
  const deadline=Date.now()+budget;
  for(const [index,model] of models.entries()) {
   // A cooldown-store outage must not turn a healthy provider into an application outage.
   if(cooldowns&&await cooldowns.isCooling(model.name).catch(()=>false))continue;
   if(rateLimits&&!await rateLimits.acquire(model.name))continue;
   const remaining=deadline-Date.now();if(remaining<1000)break;
   // Reserve time for each remaining configured model; each adapter aborts its own network request.
   const timeoutMs=Math.min(120000,Math.max(1000,Math.floor(remaining/(models.length-index))));
   try {return await model.complete({...request,timeoutMs});}
   catch(error) {if(!(error instanceof ModelUnavailableError))throw error;if(cooldowns)await cooldowns.markUnavailable(model.name,Math.max(1,Math.min(600,error.retryAfterSeconds))).catch(()=>{});}
  }
  throw new Error('All configured AI models are temporarily unavailable. Please retry later.');
 }};
}
export function parseRateLimits(value:string,models:ModelSpec[]):Map<string,number> {
 const limits=new Map<string,number>();if(!value.trim())return limits;
 const known=new Set(models.map(m=>`${m.provider}:${m.model}`));
 for(const entry of value.split(',')){
  const match=/^\s*([^=\s]+)=(\d+)\s*$/.exec(entry);
  if(!match||!known.has(match[1])||limits.has(match[1]))throw new Error('LLM_RATE_LIMITS must use distinct configured provider:model=RPM entries.');
  const rpm=Number(match[2]);if(!Number.isSafeInteger(rpm)||rpm<1||rpm>100000)throw new Error('LLM_RATE_LIMITS values must be between 1 and 100000 requests per minute.');
  limits.set(match[1],rpm);
 }
 return limits;
}
export type ModelSpec={provider:'anthropic'|'openai'|'groq'|'gemini';model:string};
export function parseModelChain(value:string):ModelSpec[] {
 const parts=value.split(',').map(x=>x.trim());
 if(parts.length<1||parts.length>5||parts.some(p=>!p))throw new Error('LLM_MODELS must list one to five provider:model entries.');
 const result=parts.map(part=>{
  const match=/^(anthropic|openai|groq|gemini):([a-zA-Z0-9][a-zA-Z0-9._/-]{0,127})$/.exec(part);
  if(!match)throw new Error('Each LLM_MODELS entry must be anthropic:model, openai:model, groq:model or gemini:model.');
  if(match[1]==='gemini' && match[2].includes('/'))throw new Error('Gemini entries must use a model ID, not a resource path.');
  return {provider:match[1] as ModelSpec['provider'],model:match[2]};
 });
 if(new Set(parts).size!==parts.length)throw new Error('LLM_MODELS contains a duplicate model.');
 return result;
}
