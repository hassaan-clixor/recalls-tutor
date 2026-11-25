import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {embeddedDatabase} from '../lib/db/client';
import {migrate} from '../lib/db/migrate';
import {saveLead,leadsCsv} from '../lib/services/leads';

test('Leads: validated, de-duplicated, consent kept once given, CSV is spreadsheet-safe and staff only',async()=>{
 const db=embeddedDatabase(new PGlite());
 try {
  await migrate(db);
  const authId=randomUUID();await db.query('INSERT INTO auth_users(id,name,email,email_verified,two_factor_enabled,created_at,updated_at) VALUES($1,$2,$3,true,true,now(),now())',[authId,'A','a@example.test']);
  const admin=(await db.query<{id:string}>('INSERT INTO app_users(auth_id,role) VALUES($1,$2) RETURNING id',[authId,'super_admin']))[0].id;
  await assert.rejects(saveLead(db,{email:'nope',examSlug:'mrcog-part-1',consent:true}),/valid email/);
  await assert.rejects(saveLead(db,{email:'x@example.test',examSlug:'../etc',consent:true}),/Unknown exam/);
  await saveLead(db,{email:' Dee@Example.test ',examSlug:'mrcog-part-1',consent:true});
  await saveLead(db,{email:'dee@example.test',examSlug:'mrcog-part-1',consent:false});
  await saveLead(db,{email:'=cmd@example.test',examSlug:'mrcog-part-1',consent:false});
  const rows=await db.query<{marketing_consent:boolean}>("SELECT marketing_consent FROM leads WHERE email='dee@example.test'");
  assert.equal(rows.length,1);assert.equal(rows[0].marketing_consent,true);
  const csv=await leadsCsv(db,admin);assert.match(csv,/"dee@example.test","mrcog-part-1","yes"/);assert.match(csv,/"'=cmd@example.test"/);
  const sid=randomUUID();await db.query('INSERT INTO auth_users(id,name,email,email_verified,created_at,updated_at) VALUES($1,$2,$3,true,now(),now())',[sid,'S','s@example.test']);
  const student=(await db.query<{id:string}>('INSERT INTO app_users(auth_id,role) VALUES($1,$2) RETURNING id',[sid,'student']))[0].id;
  await assert.rejects(leadsCsv(db,student),/permission/);
 } finally {await db.close();}
});
