import {inflateRawSync} from 'node:zlib';
// AIS-1: turn an uploaded recall file into plain text, or mark it for OCR when it is a scan, photo or screenshot.
const MAX_UNZIPPED=20*1024*1024;
export const UPLOAD_EXTENSIONS=['.txt','.csv','.tsv','.md','.pdf','.docx','.xlsx','.zip','.png','.jpg','.jpeg','.webp','.gif','.heic','.heif'];
export type ScanMediaType='image/png'|'image/jpeg'|'image/webp'|'image/gif'|'image/heic'|'application/pdf';
export type PreparedUpload={kind:'text';text:string}|{kind:'scan';mediaType:ScanMediaType};
const IMAGE_TYPES:Record<string,ScanMediaType>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.heic':'image/heic','.heif':'image/heic'};
const ascii=(b:Uint8Array,from:number,to:number)=>new TextDecoder().decode(b.subarray(from,to));
// File signatures, so a renamed file is caught before it is sent anywhere.
const SIGNATURES:Record<ScanMediaType,(b:Uint8Array)=>boolean>={'image/png':b=>b[0]===0x89&&ascii(b,1,4)==='PNG','image/jpeg':b=>b[0]===0xff&&b[1]===0xd8&&b[2]===0xff,
 'image/gif':b=>ascii(b,0,3)==='GIF','image/webp':b=>ascii(b,0,4)==='RIFF'&&ascii(b,8,12)==='WEBP','image/heic':b=>b.length>=12&&ascii(b,4,8)==='ftyp'&&['mif1','msf1','heic','heix','hevc','hevx'].includes(ascii(b,8,12)),'application/pdf':b=>ascii(b,0,5)==='%PDF-'};
class ScanNeeded extends Error {}
export const pdfPageHasText=(text:string)=>text.replace(/\s/g,'').length>=20;
export async function prepareUpload(name:string,bytes:Uint8Array):Promise<PreparedUpload> {
 const extension=name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]??'';
 const image=IMAGE_TYPES[extension];
 if(image){if(!SIGNATURES[image](bytes))throw new Error(`${name} is not a valid image.`);return {kind:'scan',mediaType:image};}
 if(extension==='.pdf') {
  try {return {kind:'text',text:await pdfText(bytes)};}
  catch(error){if(error instanceof ScanNeeded)return {kind:'scan',mediaType:'application/pdf'};throw error;}
 }
 return {kind:'text',text:await extractUploadText(name,bytes)};
}
export async function extractUploadText(name:string,bytes:Uint8Array):Promise<string> {
 const extension=name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]??'';
 if(['.txt','.csv','.tsv','.md'].includes(extension))return new TextDecoder('utf-8').decode(bytes);
 if(extension==='.docx')return docxText(bytes);
 if(extension==='.xlsx')return xlsxText(bytes);
 if(extension==='.zip')return chatZipText(bytes);
 if(extension==='.pdf')return pdfText(bytes);
 if(extension==='.doc')throw new Error('Older .doc files are not supported. Save the file as .docx or PDF and upload it again.');
 throw new Error('Upload a .txt, .csv, .tsv, .md, .pdf, .docx, .xlsx or .zip file, or a PNG, JPG, WebP or GIF image.');
}
// Validate and decompress every entry with strict limits before handing the archive to a workbook parser.
export function validateSpreadsheetArchive(bytes:Uint8Array) {
 const fail=():never=>{throw new Error('This spreadsheet is invalid, encrypted or exceeds the extraction limit.');};
 if(bytes.length<22)return fail();const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){end=i;break;}
 if(end<0||v.getUint16(end+4,true)!==0||v.getUint16(end+6,true)!==0)return fail();
 const count=v.getUint16(end+10,true),size=v.getUint32(end+12,true),start=v.getUint32(end+16,true);
 if(count>1000||count!==v.getUint16(end+8,true)||start+size!==end)return fail();
 let offset=start,total=0;const names=new Set<string>();
 for(let i=0;i<count;i++){
  if(offset+46>end||v.getUint32(offset,true)!==0x02014b50)return fail();
  const flags=v.getUint16(offset+8,true),method=v.getUint16(offset+10,true),compressed=v.getUint32(offset+20,true),expanded=v.getUint32(offset+24,true),nameLength=v.getUint16(offset+28,true),extra=v.getUint16(offset+30,true),comment=v.getUint16(offset+32,true),local=v.getUint32(offset+42,true),next=offset+46+nameLength+extra+comment;
  if(next>end||v.getUint16(offset+34,true)!==0||(flags&1)!==0||![0,8].includes(method)||expanded>MAX_UNZIPPED-total||local+30>start||v.getUint32(local,true)!==0x04034b50)return fail();
  const name=ascii(bytes,offset+46,offset+46+nameLength);if(names.has(name))return fail();names.add(name);offset=next;
  const ln=v.getUint16(local+26,true),le=v.getUint16(local+28,true),data=local+30+ln+le;
  if(data>start||compressed>start-data||v.getUint16(local+6,true)!==flags||v.getUint16(local+8,true)!==method||ascii(bytes,local+30,local+30+ln)!==name)return fail();
  let actual:number;try{actual=method===0?compressed:inflateRawSync(bytes.subarray(data,data+compressed),{maxOutputLength:Math.max(1,MAX_UNZIPPED-total)}).length;}catch{return fail();}
  if(actual!==expanded)return fail();total+=actual;
 }
 if(offset!==end||!names.has('[Content_Types].xml')||!names.has('xl/workbook.xml'))return fail();
}
async function xlsxText(bytes:Uint8Array):Promise<string> {
 validateSpreadsheetArchive(bytes);
 const ExcelJS=(await import('exceljs')).default;const workbook=new ExcelJS.Workbook();
 try{await workbook.xlsx.load(Buffer.from(bytes) as never);}catch{throw new Error('This spreadsheet could not be read. Save it again as .xlsx and retry.');}
 const lines:string[]=[];let cells=0,length=0;
 for(const sheet of workbook.worksheets){
  sheet.eachRow(row=>{const values:string[]=[];row.eachCell((cell,column)=>{
   if(++cells>10000||column>1000)throw new Error('This spreadsheet has too many populated cells or columns. Split it into smaller files.');
   const value=cell.value;let text='';
   if(value===null||value===undefined)return;
   if(typeof value==='object'&&'formula' in value){const result=value.result;text=result===null||result===undefined?'':String(result);}
   else if(typeof value==='object'&&'richText' in value)text=value.richText.map(part=>part.text).join('');
   else if(typeof value==='object'&&'text' in value)text=String(value.text);
   else if(value instanceof Date)text=value.toISOString();else text=String(value);
   values[column-1]=text.replace(/[\t\r\n]+/g,' ').trim();
  });if(values.some(Boolean)){const line=values.join('\t');length+=line.length+1;if(length>60000)throw new Error('This spreadsheet contains too much text for one job. Split it into smaller files.');lines.push(line);}});
 }
 if(!lines.length)throw new Error('This spreadsheet has no readable cell values.');return lines.join('\n');
}
// Chat archives are read in memory; only text entries are extracted and no archive paths are written to disk.
function chatZipText(bytes:Uint8Array):string {
 const fail=():never=>{throw new Error('This chat ZIP is invalid, encrypted, too large, or uses an unsupported format.');};
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.length<22)return fail();
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
 if(end<0||view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0)return fail();
 const entries=view.getUint16(end+10,true),dirSize=view.getUint32(end+12,true),dirStart=view.getUint32(end+16,true);
 if(entries>100||entries!==view.getUint16(end+8,true)||dirStart+dirSize!==end)return fail();
 let offset=dirStart,total=0;const texts:string[]=[];
 for(let n=0;n<entries;n++){
  if(offset+46>end||view.getUint32(offset,true)!==0x02014b50)return fail();
  const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),compressed=view.getUint32(offset+20,true),size=view.getUint32(offset+24,true);
  const nameLength=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true),next=offset+46+nameLength+extra+comment;
  if(next>end||view.getUint16(offset+34,true)!==0)return fail();
  const name=ascii(bytes,offset+46,offset+46+nameLength);offset=next;
  if(!/\.txt$/i.test(name))continue;
  if((flags&1)!==0||![0,8].includes(method)||size>MAX_UNZIPPED||total+size>MAX_UNZIPPED||local+30>dirStart||view.getUint32(local,true)!==0x04034b50)return fail();
  const localName=view.getUint16(local+26,true),localExtra=view.getUint16(local+28,true),start=local+30+localName+localExtra;
  if(start>dirStart||compressed>dirStart-start||view.getUint16(local+6,true)!==flags||view.getUint16(local+8,true)!==method||ascii(bytes,local+30,local+30+localName)!==name)return fail();
  let data:Uint8Array;try{data=method===0?bytes.subarray(start,start+compressed):inflateRawSync(bytes.subarray(start,start+compressed),{maxOutputLength:MAX_UNZIPPED-total});}catch{return fail();}
  if(data.length!==size)return fail();total+=data.length;
  const text=new TextDecoder('utf-8').decode(data);if(text.trim())texts.push(text);
 }
 if(offset!==end)return fail();
 if(!texts.length)throw new Error('This ZIP has no readable .txt chat exports.');
 return texts.join('\n\n');
}
async function pdfText(bytes:Uint8Array) {
 if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw new Error('This file is not a valid PDF.');
 const {extractText,getDocumentProxy}=await import('unpdf');
 let pages:string[];
 try {
  const pdf=await getDocumentProxy(new Uint8Array(bytes));
  try{pages=(await extractText(pdf)).text;}finally{await pdf.cleanup();}
 } catch(error) {
  throw new Error(/password/i.test(error instanceof Error?error.message:'')?'This PDF is password-protected. Remove the password and upload it again.':'This PDF could not be read.');
 }
 // Check each page: one selectable page must not hide a scanned page elsewhere in the document.
 if(pages.some(page=>!pdfPageHasText(page)))throw new ScanNeeded('This PDF has no selectable text on at least one page.');
 return pages.join('\n\n');
}
// A .docx file is a zip archive; the body text lives in word/document.xml.
function docxText(bytes:Uint8Array) {
 const xml=zipEntry(bytes,'word/document.xml');
 if(xml===null)throw new Error('This Word file could not be read. Save it again as .docx and retry.');
 const text=xml.replace(/<w:tab\/>/g,'\t').replace(/<w:(?:br|cr)\b[^>]*\/>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'')
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&amp;/g,'&');
 if(!text.trim())throw new Error('This Word file has no text.');
 return text;
}
function zipEntry(bytes:Uint8Array,wanted:string):string|null {
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
 if(end<0||view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0)return null;
 const entries=view.getUint16(end+10,true),directory=view.getUint32(end+16,true);let offset=directory;
 if(entries>1000||entries!==view.getUint16(end+8,true)||directory+view.getUint32(end+12,true)!==end)return null;
 for(let n=0;n<entries&&offset+46<=end;n++) {
  if(view.getUint32(offset,true)!==0x02014b50)return null;
  const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),compressed=view.getUint32(offset+20,true),size=view.getUint32(offset+24,true);
  const nameLength=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true);
  if(offset+46+nameLength+extra+comment>end||view.getUint16(offset+34,true)!==0)return null;
  const name=new TextDecoder().decode(bytes.subarray(offset+46,offset+46+nameLength));
  offset+=46+nameLength+extra+comment;
  if(name!==wanted)continue;
  if((flags&1)!==0||size>MAX_UNZIPPED||local+30>directory||view.getUint32(local,true)!==0x04034b50)return null;
  const localName=view.getUint16(local+26,true),start=local+30+localName+view.getUint16(local+28,true);
  if(start>directory||compressed>directory-start||view.getUint16(local+6,true)!==flags||view.getUint16(local+8,true)!==method||ascii(bytes,local+30,local+30+localName)!==name)return null;
  const data=bytes.subarray(start,start+compressed);let decoded:Uint8Array;
  if(method===0)decoded=data;else if(method===8){try{decoded=inflateRawSync(data,{maxOutputLength:MAX_UNZIPPED});}catch{return null;}}else return null;
  return decoded.length===size?new TextDecoder().decode(decoded):null;
 }
 return null;
}
