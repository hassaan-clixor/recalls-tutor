import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localOcrReader} from '../lib/integrations/llm/local-ocr';
import {defaultVisionReader} from '../lib/integrations/llm/vision';
import {prepareUpload} from '../lib/services/extract-text';

test('local OCR reads an image without an AI provider',async()=>{
 const bytes=await readFile('tests/fixtures/ocr-sample.png');
 const result=await localOcrReader().read({fileName:'sample.png',mediaType:'image/png',data:bytes});
 assert.match(result.text,/RECALL TEST QUESTION NUMBER 123/i);assert.equal(result.model,'tesseract-local-eng');
 assert.equal(defaultVisionReader().name,'tesseract-local');
});
test('local OCR reads an HEIC photo without an AI provider',async()=>{
 const bytes=await readFile('tests/fixtures/ocr-sample.heic');
 assert.deepEqual(await prepareUpload('sample.heic',bytes),{kind:'scan',mediaType:'image/heic'});
 const result=await localOcrReader().read({fileName:'sample.heic',mediaType:'image/heic',data:bytes});
 assert.match(result.text,/RECALL TEST QUESTION NUMBER 123/i);
});
test('mixed PDFs preserve selectable text and locally read scanned pages',async()=>{
 const bytes=await readFile('tests/fixtures/ocr-mixed.pdf');
 assert.deepEqual(await prepareUpload('mixed.pdf',bytes),{kind:'scan',mediaType:'application/pdf'});
 const result=await localOcrReader().read({fileName:'mixed.pdf',mediaType:'application/pdf',data:bytes});
 assert.match(result.text,/SELECTABLE TEXT PAGE FOR MIXED DOCUMENT/);
 assert.match(result.text,/RECALL TEST QUESTION NUMBER 123/i);
 assert.ok(result.text.indexOf('SELECTABLE')<result.text.indexOf('RECALL'));
});
test('local OCR reads both pages of a scanned PDF',async()=>{
 const bytes=await readFile('tests/fixtures/ocr-sample.pdf');
 const result=await localOcrReader().read({fileName:'scan.pdf',mediaType:'application/pdf',data:bytes});
 assert.equal((result.text.match(/RECALL TEST QUESTION NUMBER 123/gi)??[]).length,2);
 await assert.rejects(localOcrReader().read({fileName:'bad.pdf',mediaType:'application/pdf',data:new Uint8Array()}),/could not be opened/);
});
