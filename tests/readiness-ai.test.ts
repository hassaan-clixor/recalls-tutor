import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readiness} from '../lib/readiness';

test('readiness checks the configured AI chain without exposing keys',async()=>{
 const keys=['LLM_MODELS','LLM_RATE_LIMITS','ANTHROPIC_API_KEY','OPENAI_API_KEY','GROQ_API_KEY','GEMINI_API_KEY'] as const;
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  keys.forEach(k=>delete process.env[k]);
  const check=async()=>(await readiness(null)).checks.find(c=>c.name==='AI text models')!;
  assert.equal((await check()).ok,false);
  process.env.LLM_MODELS='openai:example,gemini:example';process.env.OPENAI_API_KEY='test-secret-value';
  assert.match((await check()).detail,/GEMINI_API_KEY/);assert.equal((await check()).ok,false);
  process.env.GEMINI_API_KEY='another-secret';const ready=await check();assert.equal(ready.ok,true);assert.doesNotMatch(ready.detail,/test-secret-value|another-secret/);
  process.env.LLM_RATE_LIMITS='groq:not-configured=1';assert.equal((await check()).ok,false);delete process.env.LLM_RATE_LIMITS;
  process.env.LLM_MODELS='invalid';assert.equal((await check()).ok,false);
 }finally{for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}}
});
