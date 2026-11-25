'use server';
import {getDatabase} from '@/lib/db/client';
import {saveLead} from '@/lib/services/leads';
export type LeadResult={error?:string;success?:string};
export async function joinList(_:LeadResult,form:FormData):Promise<LeadResult> {
 try {
  const get=(k:string)=>{const v=form.get(k);return typeof v==='string'?v:'';};
  if(get('website'))return {success:'Thank you. You are on the list.'};// hidden field: bots fill it in
  await saveLead(getDatabase(),{email:get('email'),examSlug:get('examSlug'),consent:get('consent')==='yes'});
  return {success:'Thank you. You are on the list. Start your free trial any time.'};
 } catch(error){return {error:error instanceof Error&&!('query' in error)&&!('code' in error)?error.message:'Could not save that. Please try again.'};}
}
