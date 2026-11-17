/** Stream UTF-8 recall text into bounded pieces without dropping characters or splitting surrogate pairs. */
export async function* splitRecallStream(source:AsyncIterable<Uint8Array>,options:{maxBytes:number;maxCharacters:number}):AsyncGenerator<string> {
 const {maxBytes,maxCharacters}=options;
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||!Number.isSafeInteger(maxCharacters)||maxCharacters<2)throw new Error('Invalid recall stream limits.');
 const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
 let pending='',bytes=0;
 function take():string {
  let end=maxCharacters;
  // Prefer a natural boundary in the latter half, while preserving every separator in the output.
  const floor=Math.floor(maxCharacters/2),window=pending.slice(0,maxCharacters);
  let boundary=window.lastIndexOf('\n');
  if(boundary<floor)boundary=Math.max(window.lastIndexOf(' '),window.lastIndexOf('\t'));
  if(boundary>=floor)end=boundary+1;
  const last=pending.charCodeAt(end-1),next=pending.charCodeAt(end);
  if(last>=0xd800&&last<=0xdbff&&next>=0xdc00&&next<=0xdfff)end--;
  const result=pending.slice(0,end);pending=pending.slice(end);return result;
 }
 for await(const part of source){
  if(!(part instanceof Uint8Array))throw new Error('Invalid recall stream chunk.');
  bytes+=part.byteLength;if(bytes>maxBytes)throw new Error('Recall file exceeds the allowed size.');
  // A storage provider may yield a very large byte buffer. Decode it in bounded slices so that
  // the working text buffer does not grow to the full file size before the first piece is emitted.
  for(let offset=0;offset<part.length;offset+=65536){
   pending+=decoder.decode(part.subarray(offset,offset+65536),{stream:true});
   while(pending.length>maxCharacters)yield take();
  }
 }
 pending+=decoder.decode();
 while(pending.length>maxCharacters)yield take();
 if(pending)yield pending;
}
