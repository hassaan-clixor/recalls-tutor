import path from 'node:path';
import type {VisionReader} from './vision';
import {pdfPageHasText} from '../../services/extract-text';

/** Image bytes and English language data stay local; no remote OCR endpoint or language download is used. */
export function localOcrReader():VisionReader {
 return {name:'tesseract-local',async read(input){
  const {createWorker}=await import('tesseract.js');
  const langPath=path.join(path.dirname(require.resolve('@tesseract.js-data/eng')),'4.0.0_best_int');
  let worker:Awaited<ReturnType<typeof createWorker>>|undefined;
  let pdf:Awaited<ReturnType<typeof import('unpdf')['getDocumentProxy']>>|undefined;
  try {
   if(input.mediaType==='application/pdf'){
    const {getDocumentProxy}=await import('unpdf');
    try{pdf=await getDocumentProxy(new Uint8Array(input.data));}catch{throw new Error('The scanned PDF could not be opened. Check that it is valid and not password protected.');}
    if(pdf.numPages>20)throw new Error('Scanned PDFs are limited to 20 pages per file. Split the PDF and retry.');
   }
   worker=await createWorker('eng',1,{langPath,cacheMethod:'none',gzip:true});
   const pages:string[]=[];
   if(pdf){
    const {renderPageAsImage,extractText}=await import('unpdf');
    const selectable=(await extractText(pdf)).text;
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
     const text=selectable[pageNumber-1]??'';
     if(pdfPageHasText(text)){pages.push(text.trim());continue;}
     const page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale:2});
     if(!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width*viewport.height>12000000)throw new Error('A scanned PDF page is too large to process safely. Resize or split the file and retry.');
     const image=await renderPageAsImage(pdf,pageNumber,{scale:2,canvasImport:()=>import('@napi-rs/canvas')});
     const result=await worker.recognize(Buffer.from(image));if(result.data.text.trim())pages.push(result.data.text.trim());
    }
   }else {
    let image:Uint8Array=input.data;
    if(input.mediaType==='image/heic'){
     const decode=(await import('heic-decode')).default,frames=await decode.all({buffer:input.data});
     try {
      if(frames.length!==1)throw new Error('HEIC files must contain one image.');
      const frame=frames[0];
      if(frame.width<1||frame.height<1||frame.width*frame.height>12000000)throw new Error('The HEIC image is too large to process safely. Resize it and retry.');
      const decoded=await frame.decode(),{createCanvas}=await import('@napi-rs/canvas'),canvas=createCanvas(decoded.width,decoded.height),context=canvas.getContext('2d'),pixels=context.createImageData(decoded.width,decoded.height);
      pixels.data.set(decoded.data);context.putImageData(pixels,0,0);image=canvas.toBuffer('image/png');
     } finally {frames.dispose();}
    }
    const result=await worker.recognize(Buffer.from(image));if(result.data.text.trim())pages.push(result.data.text.trim());
   }
   return {text:pages.join('\n\n'),model:'tesseract-local-eng',costUsd:null};
  } catch(error) {if(error instanceof Error&&(/scanned PDF|Scanned PDFs|HEIC/.test(error.message)))throw error;throw new Error('Local OCR could not read this file. Try a clear image or PDF, or upload text instead.');}
  finally {if(worker)await worker.terminate();if(pdf)await pdf.cleanup();}
 }};
}
