import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitRecallStream} from '../lib/services/recall-stream';

async function* pieces(bytes:Uint8Array,size:number){for(let i=0;i<bytes.length;i+=size)yield bytes.subarray(i,i+size);}
async function collect(source:AsyncIterable<Uint8Array>,maxBytes=1000,maxCharacters=9){const chunks:string[]=[];for await(const item of splitRecallStream(source,{maxBytes,maxCharacters}))chunks.push(item);return chunks;}
test('streaming recall splitter preserves UTF-8 and content across arbitrary byte boundaries',async()=>{
 const text='One recall 😀\nSecond recall with a longwordabcdefghij\nThird';
 const chunks=await collect(pieces(new TextEncoder().encode(text),2));
 assert.equal(chunks.join(''),text);assert.ok(chunks.every(chunk=>chunk.length<=9));
 assert.ok(chunks.every(chunk=>!/[\uD800-\uDBFF]$/.test(chunk)&&! /^[\uDC00-\uDFFF]/.test(chunk)));
});
test('streaming recall splitter enforces byte limits and rejects malformed UTF-8',async()=>{
 await assert.rejects(collect(pieces(new TextEncoder().encode('123456'),2),5),/exceeds/);
 await assert.rejects(collect(pieces(new Uint8Array([0xc3,0x28]),1)),/encoded data|encoding/i);
 const exact=await collect(pieces(new TextEncoder().encode('12345'),2),5);assert.equal(exact.join(''),'12345');
});
test('a large single storage chunk is split without losing any characters',async()=>{
 const text='Start 😀 '+('a'.repeat(250000))+' end';const bytes=new TextEncoder().encode(text);
 const chunks=await collect(pieces(bytes,bytes.length),bytes.length,60000);
 assert.equal(chunks.join(''),text);assert.ok(chunks.length>4);assert.ok(chunks.every(chunk=>chunk.length<=60000));
});
