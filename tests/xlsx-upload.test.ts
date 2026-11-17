import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Workbook} from 'exceljs';
import {extractUploadText} from '../lib/services/extract-text';

test('XLSX intake extracts values from each sheet and keeps empty columns',async()=>{
 const book=new Workbook(),sheet=book.addWorksheet('Recalls');
 sheet.addRow(['Question',null,'Answer']);sheet.addRow(['Synthetic recall',null,'Option B']);
 const other=book.addWorksheet('More');other.addRow([{richText:[{text:'Another '},{text:'recall'}]},{formula:'1+1',result:2}]);
 const bytes=new Uint8Array(await book.xlsx.writeBuffer());
 const text=await extractUploadText('recalls.xlsx',bytes);
 assert.match(text,/Question\t\tAnswer/);assert.match(text,/Synthetic recall\t\tOption B/);assert.match(text,/Another recall\t2/);
});
test('XLSX intake rejects malformed and oversized declared archives',async()=>{
 await assert.rejects(extractUploadText('fake.xlsx',new Uint8Array([1,2,3])),/invalid/);
 const book=new Workbook();book.addWorksheet('Sheet').addRow(['text']);const bytes=new Uint8Array(await book.xlsx.writeBuffer());
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22,central=view.getUint32(end+16,true);view.setUint32(central+24,21*1024*1024,true);
 await assert.rejects(extractUploadText('huge.xlsx',bytes),/extraction limit/);
});
