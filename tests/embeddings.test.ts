import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cosineSimilarity,openaiEmbeddings} from '../lib/integrations/llm/embeddings';

test('embedding adapter batches inputs and restores provider order',async()=>{
 let calls=0;
 const fake:typeof fetch=async (_url,init)=>{calls++;const body=JSON.parse(String(init?.body));return new Response(JSON.stringify({data:body.input.map((_:string,index:number)=>({index,embedding:[index+1,1]})).reverse()}),{status:200});};
 const vectors=await openaiEmbeddings('test-model','test-key',fake).embed(Array.from({length:101},(_,i)=>`text ${i}`));
 assert.equal(calls,2);assert.equal(vectors.length,101);assert.deepEqual(vectors[1],[2,1]);assert.deepEqual(vectors[100],[1,1]);
});
test('invalid or incomplete embedding responses fail closed',async()=>{
 const fake:typeof fetch=async()=>new Response(JSON.stringify({data:[{index:0,embedding:[0,0]}]}),{status:200});
 await assert.rejects(openaiEmbeddings('test-model','test-key',fake).embed(['hello']),/invalid vector/);
 assert.throws(()=>cosineSimilarity([1,0],[1]),/dimensions/);
 assert.equal(cosineSimilarity([1,0],[1,0]),1);
 assert.equal(cosineSimilarity([1,0],[0,1]),0);
});
