export interface EmbeddingModel {name:string; embed(texts:string[]):Promise<number[][]>}

/** Fixed provider endpoint; sends question stems, never raw upload files. */
export function openaiEmbeddings(model:string,key:string,fetcher:typeof fetch=fetch):EmbeddingModel {
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)||!key)throw new Error('Invalid embedding configuration.');
 return {name:`openai:${model}`,async embed(texts){
  const output:number[][]=[];
  for(let offset=0;offset<texts.length;offset+=100){
   const input=texts.slice(offset,offset+100);
   const response=await fetcher('https://api.openai.com/v1/embeddings',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify({model,input,encoding_format:'float'}),signal:AbortSignal.timeout(120000)});
   if(!response.ok)throw new Error('The embedding service is unavailable. Retry the job or check its configuration.');
   const payload=await response.json() as {data?:{index?:number;embedding?:number[]}[]};
   if(!Array.isArray(payload.data)||payload.data.length!==input.length)throw new Error('The embedding service returned an invalid response.');
   const sorted=[...payload.data].sort((a,b)=>(a.index??-1)-(b.index??-1));
   for(let i=0;i<sorted.length;i++){
    const vector=sorted[i].embedding;
    if(sorted[i].index!==i||!Array.isArray(vector)||!vector.length||vector.some(n=>typeof n!=='number'||!Number.isFinite(n))||!vector.some(n=>n!==0))throw new Error('The embedding service returned an invalid vector.');
    if(output.length&&vector.length!==output[0].length)throw new Error('Embedding dimensions do not match.');
    output.push(vector);
   }
  }
  return output;
 }};
}
export function cosineSimilarity(a:number[],b:number[]):number {
 if(!a.length||a.length!==b.length)throw new Error('Embedding dimensions do not match.');
 let dot=0,aa=0,bb=0;
 for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i])||!Number.isFinite(b[i]))throw new Error('Invalid embedding vector.');dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}
 if(!aa||!bb)throw new Error('Invalid embedding vector.');
 return Math.max(-1,Math.min(1,dot/Math.sqrt(aa*bb)));
}
export function configuredEmbeddings():EmbeddingModel|null {
 const model=process.env.DEDUPE_EMBEDDING_MODEL?.trim();
 if(!model)return null;
 if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is required for semantic deduplication.');
 return openaiEmbeddings(model,process.env.OPENAI_API_KEY);
}
