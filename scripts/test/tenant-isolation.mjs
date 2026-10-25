#!/usr/bin/env node
// Integration tests against real local Auth, PostgREST, Storage and PostgreSQL.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { requireFunctionRuntime } from './function-preflight.mjs';
const status=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8'}));
if(status.API_URL!=='http://127.0.0.1:54321') throw new Error('REFUSED: API must be http://127.0.0.1:54321');
if(status.DB_URL!=='postgresql://postgres:postgres@127.0.0.1:54322/postgres') throw new Error('REFUSED: unexpected local DB URL');
const api=status.API_URL, anon=status.ANON_KEY, service=status.SERVICE_ROLE_KEY;
await requireFunctionRuntime(api);
const tag=Date.now().toString(36), password='Synthetic-only-42!';
let failures=0;
async function request(token,path,method='GET',body,headers={}) {
 const r=await fetch(api+path,{method,headers:{apikey:anon,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation',...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await r.text(); let data; try {data=JSON.parse(text);} catch {data=text;}
 return {ok:r.ok,status:r.status,data};
}
function good(r) {assert(r.ok,JSON.stringify(r)); return r.data;}
function denied(r) {
 if(r.ok) { assert.deepEqual(r.data,[]); return; }
 assert(['42501','23503','P0001','PGRST106'].includes(r.data?.code),JSON.stringify(r));
}
function rlsDenied(r) { assert.equal(r.status,403,JSON.stringify(r));assert.equal(r.data?.code,'42501'); }
const snapshot=(table,hid)=>sql("SELECT coalesce(jsonb_agg(t ORDER BY t.id)::text,'[]') FROM public."+table+" t WHERE household_id='"+hid+"'");
const rpc=(u,name,body={})=>request(u.token??u,'/rest/v1/rpc/'+name,'POST',body);
const rows=(u,table,filter='')=>request(u.token??u,'/rest/v1/'+table+'?select=*'+filter);
const insert=(u,table,body)=>request(u.token??u,'/rest/v1/'+table,'POST',body);
const sql=q=>execFileSync('psql',[status.DB_URL,'-X','-A','-t','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8'}).trim();
async function user(label,confirmed=true) {
 const email=label.toLowerCase()+'-'+tag+'@example.test';
 const u=good(await request(service,'/auth/v1/admin/users','POST',{email,password,email_confirm:confirmed},{apikey:service}));
 const login=await request(anon,'/auth/v1/token?grant_type=password','POST',{email,password});
 return {id:u.id,email,token:login.data.access_token};
}
async function publicUser(label) {
 const email=label.toLowerCase()+'-'+tag+'@example.test';
 const r=good(await request(anon,'/auth/v1/signup','POST',{email,password}));
 const id=r.user?.id??r.id;
 return {id,email,token:null};
}
// Unconfirmed users normally cannot obtain a password session. For negative RPC
// tests, mint a local authenticated JWT for that real unverified account using
// the local stack's JWT secret, without altering its verification state.
function unverifiedToken(u) {
 const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({sub:u.id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,email:u.email})).toString('base64url');
 return import('node:crypto').then(({createHmac})=>header+'.'+payload+'.'+createHmac('sha256',status.JWT_SECRET).update(header+'.'+payload).digest('base64url'));
}
async function family(label) {
 const admin=await user(label+'-admin');
 const hid=good(await rpc(admin,'create_household',{p_care_recipient_name:'Fictional '+label,p_display_name:'Admin '+label}));
 const member=await user(label+'-member');
 const iid=good(await rpc(admin,'invite_member',{p_email:member.email}));
 good(await rpc(member,'accept_invite',{p_invite_id:iid,p_display_name:'Member '+label}));
 const people=good(await rpc(admin,'household_people'));
 return {admin,member,hid,caregiver:people.find(p=>p.user_id===admin.id).caregiver_id};
}
async function check(name,fn) {try {await fn();console.log('PASS '+name);}catch(e){failures++;console.log('FAIL '+name+' — '+e.message);}}
let A,B,unverified,fixtures={};
const samples={
 health_records:{date:'2026-01-01',feed_bags:3},
 bp_readings:{date:'2026-01-01',systolic:120,diastolic:80},
 medicines:{name:'Fictional medicine'},
 appointments:{date:'2026-01-01',doctor_name:'Fictional doctor',reason:'Test'},
 hospital_stays:{date:'2026-01-01',person_name:'Fictional caregiver',start_hour:9,end_hour:24},
 custom_actions:{name:'Fictional tracker'},
 written_notes:{date:'2026-01-01',content:'Synthetic note'},
 audio_transcripts:{date:'2026-01-01',transcript:'Synthetic transcript',summary:'Synthetic summary',audio_path:null}
};
try {
 A=await family('A'); B=await family('B');
 for(const [t,s] of Object.entries(samples)) fixtures[t]=good(await insert(A.admin,t,{...s,household_id:A.hid}))[0];
 samples.medicine_logs={date:'2026-01-01',medicine_id:fixtures.medicines.id};
 samples.dose_skips={for_date:'2026-01-01',for_minute:480,medicine_id:fixtures.medicines.id};
 samples.custom_action_logs={date:'2026-01-01',action_id:fixtures.custom_actions.id,value:1};
 for(const t of ['medicine_logs','dose_skips','custom_action_logs']) fixtures[t]=good(await insert(A.admin,t,{...samples[t],household_id:A.hid}))[0];
 fixtures.caregivers=good(await rows(A.admin,'caregivers','&household_id=eq.'+A.hid))[0];
 fixtures.household_invites=good(await rows(A.admin,'household_invites','&household_id=eq.'+A.hid))[0];
 fixtures.audit_log=good(await rows(A.admin,'audit_log','&household_id=eq.'+A.hid))[0];
 fixtures.household_sync=good(await rows(A.admin,'household_sync','&household_id=eq.'+A.hid))[0];
 fixtures.household_members=good(await rows(A.admin,'household_members','&household_id=eq.'+A.hid))[0];
 fixtures.households={id:A.hid};
} catch(e) { console.log('FAIL setup — '+e.message);process.exit(1); }

await check('1 cross-family reads: every table, id and household filter',async()=>{
 for(const [t,row] of Object.entries(fixtures)) {
  const filter=t==='households'?'&id=eq.'+A.hid:'&household_id=eq.'+A.hid;
  assert.deepEqual(good(await rows(B.member,t,filter)),[]);
  assert(good(await rows(A.admin,t,filter)).length>0);
  const key=row.id?'&id=eq.'+row.id:t==='household_members'?'&user_id=eq.'+row.user_id:filter;
  assert.deepEqual(good(await rows(B.member,t,key)),[]);
  assert(good(await rows(A.admin,t,key)).length>0);
 }
});
await check('2 cross-family mutations and reading RPCs',async()=>{
 for(const [t,s] of Object.entries(samples)) {
  const before=snapshot(t,A.hid);
  rlsDenied(await insert(B.member,t,{...s,household_id:A.hid}));
  denied(await request(B.member.token,'/rest/v1/'+t+'?id=eq.'+fixtures[t].id,'PATCH',{household_id:A.hid}));
  denied(await request(B.member.token,'/rest/v1/'+t+'?id=eq.'+fixtures[t].id,'DELETE'));
  assert.equal(good(await rows(A.admin,t,'&id=eq.'+fixtures[t].id)).length,1);
  assert.equal(snapshot(t,A.hid),before);
  // Identical operations succeed for the rightful family on a disposable row.
  const control=good(await insert(A.admin,t,{...s,household_id:A.hid,...(t==='health_records'?{date:'2026-12-01'}:t==='dose_skips'?{for_date:'2026-12-01'}:{})}))[0];
  assert.equal(good(await request(A.admin.token,'/rest/v1/'+t+'?id=eq.'+control.id,'PATCH',{household_id:A.hid}))[0].id,control.id);
  assert.equal(good(await request(A.admin.token,'/rest/v1/'+t+'?id=eq.'+control.id,'DELETE'))[0].id,control.id);
 }
 const beforeDays=snapshot('health_records',A.hid), beforeBp=snapshot('bp_readings',A.hid);
 rlsDenied(await rpc(B.member,'log_reading',{p_household_id:A.hid,p_date:'2026-01-02',p_feed_bags:1}));
 denied(await rpc(B.member,'log_bp_reading',{p_household_id:A.hid,p_date:'2026-01-02',p_systolic:120,p_diastolic:80,p_caregiver_id:null,p_recorded_by:'Test'}));
 assert.equal(snapshot('health_records',A.hid),beforeDays);
 assert.equal(snapshot('bp_readings',A.hid),beforeBp);
 good(await rpc(A.admin,'log_reading',{p_household_id:A.hid,p_date:'2026-01-02',p_feed_bags:1}));
 good(await rpc(A.admin,'log_bp_reading',{p_household_id:A.hid,p_date:'2026-01-02',p_systolic:120,p_diastolic:80,p_caregiver_id:null,p_recorded_by:'Test'}));
});
await check('3 storage isolation and malformed paths',async()=>{
 const path=A.hid+'/2026-01-01/synthetic.txt';
 const upload=async(u,p)=>fetch(api+'/storage/v1/object/audio-files/'+p,{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+u.token,'Content-Type':'text/plain'},body:'synthetic'});
 assert((await upload(A.admin,path)).ok);
 assert(!(await fetch(api+'/storage/v1/object/authenticated/audio-files/'+path,{headers:{apikey:anon,Authorization:'Bearer '+B.member.token}})).ok);
 assert(!(await upload(B.member,A.hid+'/2026-01-01/foreign.txt')).ok);
 await request(B.member.token,'/storage/v1/object/audio-files','DELETE',{prefixes:[path]});
 assert((await fetch(api+'/storage/v1/object/authenticated/audio-files/'+path,{headers:{apikey:anon,Authorization:'Bearer '+A.admin.token}})).ok);
 good(await request(A.admin.token,'/storage/v1/object/audio-files','DELETE',{prefixes:[path]}));
 for(const p of ['nofolder','not-a-uuid/day/file','../file']) assert(!(await upload(B.member,p)).ok);
});
await check('4 transcribe-audio tenant boundary and malformed paths',async()=>{
 const path=A.hid+'/2026-01-01/'+Date.now()+'.webm';
 const upload=await fetch(api+'/storage/v1/object/audio-files/'+path,{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+A.admin.token,'Content-Type':'audio/webm'},body:'synthetic-audio-only'});
 assert(upload.ok);
 const transcribe=(u,p)=>request(u.token,'/functions/v1/transcribe-audio','POST',{storagePath:p});
 const own=await transcribe(A.admin,path);
 assert.equal(own.status,500,JSON.stringify(own));
 assert.deepEqual(own.data,{error:'OPENAI_API_KEY is not configured',code:'transcription_not_configured'});
 const expected={error:'Audio is unavailable or you do not have access.'};
 for(const p of [path,'nofolder.webm','not-a-uuid/2026-01-01/1.webm',A.hid+'/../1.webm',A.hid+'/2026-01-01/0.webm']) {
  const result=await transcribe(B.member,p);assert.equal(result.status,403,JSON.stringify(result));assert.deepEqual(result.data,expected);
 }
 const missing=await transcribe(A.admin,A.hid+'/2026-01-01/0.webm');
 assert.equal(missing.status,403);assert.deepEqual(missing.data,expected);
 good(await request(A.admin.token,'/storage/v1/object/audio-files','DELETE',{prefixes:[path]}));
});
await check('5 composite medicine and caregiver foreign keys',async()=>{
 denied(await insert(B.member,'medicine_logs',{household_id:B.hid,date:'2026-01-01',medicine_id:fixtures.medicines.id}));
 denied(await insert(B.member,'dose_skips',{...samples.dose_skips,household_id:B.hid}));
 for(const t of ['health_records','bp_readings','medicine_logs','dose_skips','custom_action_logs','written_notes','audio_transcripts','hospital_stays']){
  const s={...samples[t]}; if(t==='medicine_logs'||t==='dose_skips') s.medicine_id=good(await insert(B.admin,'medicines',{household_id:B.hid,name:'B med'}))[0].id;
  if(t==='custom_action_logs') s.action_id=good(await insert(B.admin,'custom_actions',{household_id:B.hid,name:'B action'}))[0].id;
  denied(await insert(B.member,t,{...s,...(t==='dose_skips'?{for_date:'2026-01-03'}:{date:'2026-01-03'}),household_id:B.hid,caregiver_id:A.caregiver}));
 }
});
await check('6 anonymous access and private-schema API',async()=>{
 for(const t of Object.keys(fixtures)) denied(await rows(anon,t));
 for(const [name,args] of [['create_household',{p_care_recipient_name:'Test',p_display_name:'Test'}],['pending_invite',{}],['household_people',{}],['invite_member',{p_email:'test@example.test'}],['accept_invite',{p_invite_id:fixtures.household_invites.id,p_display_name:'Test'}],['revoke_invite',{p_invite_id:fixtures.household_invites.id}],['remove_member',{p_user_id:A.member.id}],['log_reading',{p_household_id:A.hid,p_date:'2026-01-04'}],['log_bp_reading',{p_household_id:A.hid,p_date:'2026-01-04',p_systolic:120,p_diastolic:80,p_caregiver_id:null,p_recorded_by:'Test'}]]) denied(await rpc(anon,name,args));
 denied(await request(A.admin.token,'/rest/v1/rpc/is_member','POST',{hid:A.hid},{'Content-Profile':'app_private'}));
});
await check('7 same-family member cannot perform admin operations',async()=>{
 const beforeCaregivers=snapshot('caregivers',A.hid);
 const beforeInvites=snapshot('household_invites',A.hid);
 const beforeMembers=sql("SELECT jsonb_agg(m ORDER BY user_id)::text FROM public.household_members m WHERE household_id='"+A.hid+"'");
 const beforeHousehold=sql("SELECT row_to_json(h)::text FROM public.households h WHERE id='"+A.hid+"'");
 denied(await rpc(A.member,'invite_member',{p_email:'other@example.test'}));
 denied(await rpc(A.member,'revoke_invite',{p_invite_id:fixtures.household_invites.id}));
 denied(await rpc(A.member,'remove_member',{p_user_id:A.admin.id}));
 rlsDenied(await insert(A.member,'caregivers',{household_id:A.hid,display_name:'Forbidden'}));
 denied(await request(A.member.token,'/rest/v1/caregivers?id=eq.'+A.caregiver,'PATCH',{display_name:'Forbidden'}));
 denied(await request(A.member.token,'/rest/v1/households?id=eq.'+A.hid,'PATCH',{care_recipient_name:'Forbidden'}));
 assert.equal(snapshot('caregivers',A.hid),beforeCaregivers);
 assert.equal(snapshot('household_invites',A.hid),beforeInvites);
 assert.equal(sql("SELECT jsonb_agg(m ORDER BY user_id)::text FROM public.household_members m WHERE household_id='"+A.hid+"'"),beforeMembers);
 assert.equal(sql("SELECT row_to_json(h)::text FROM public.households h WHERE id='"+A.hid+"'"),beforeHousehold);
 const cid=good(await insert(A.admin,'caregivers',{household_id:A.hid,display_name:'Role control'}))[0].id;
 assert.equal(good(await request(A.admin.token,'/rest/v1/caregivers?id=eq.'+cid,'PATCH',{display_name:'Role control renamed'}))[0].id,cid);
 assert.equal(good(await request(A.admin.token,'/rest/v1/households?id=eq.'+A.hid,'PATCH',{care_recipient_name:'Fictional A'}))[0].id,A.hid);
 const u=await user('role-control'), iid=good(await rpc(A.admin,'invite_member',{p_email:u.email}));
 denied(await rpc(A.member,'revoke_invite',{p_invite_id:iid}));
 good(await rpc(A.admin,'revoke_invite',{p_invite_id:iid}));
 const next=good(await rpc(A.admin,'invite_member',{p_email:u.email}));
 good(await rpc(u,'accept_invite',{p_invite_id:next,p_display_name:'Role member'}));
 denied(await rpc(A.member,'remove_member',{p_user_id:u.id}));
 good(await rpc(A.admin,'remove_member',{p_user_id:u.id}));
});
await check('8 foreign admin cannot manage A',async()=>{
 const before=snapshot('caregivers',A.hid);
 const beforeMembers=sql("SELECT jsonb_agg(m ORDER BY user_id)::text FROM public.household_members m WHERE household_id='"+A.hid+"'");
 denied(await rpc(B.admin,'revoke_invite',{p_invite_id:fixtures.household_invites.id}));
 denied(await rpc(B.admin,'remove_member',{p_user_id:A.member.id}));
 denied(await rpc(B.admin,'invite_member',{p_email:'foreign@example.test',p_caregiver_id:A.caregiver}));
 denied(await request(B.admin.token,'/rest/v1/households?id=eq.'+A.hid,'PATCH',{care_recipient_name:'Foreign'}));
 denied(await request(B.admin.token,'/rest/v1/caregivers?id=eq.'+A.caregiver,'PATCH',{display_name:'Foreign'}));
 assert.equal(snapshot('caregivers',A.hid),before);
 assert.equal(sql("SELECT jsonb_agg(m ORDER BY user_id)::text FROM public.household_members m WHERE household_id='"+A.hid+"'"),beforeMembers);
 assert.equal(good(await request(A.admin.token,'/rest/v1/households?id=eq.'+A.hid,'PATCH',{care_recipient_name:'Fictional A'}))[0].id,A.hid);
 assert.equal(good(await request(A.admin.token,'/rest/v1/caregivers?id=eq.'+A.caregiver,'PATCH',{display_name:'Admin A'}))[0].id,A.caregiver);
 const cid=good(await insert(A.admin,'caregivers',{household_id:A.hid,display_name:'Foreign admin control'}))[0].id;
 denied(await rpc(B.admin,'invite_member',{p_email:'cross-control-'+tag+'@example.test',p_caregiver_id:cid}));
 const iid=good(await rpc(A.admin,'invite_member',{p_email:'cross-control-'+tag+'@example.test',p_caregiver_id:cid}));
 denied(await rpc(B.admin,'revoke_invite',{p_invite_id:iid}));
 assert.equal(good(await rows(A.admin,'household_invites','&id=eq.'+iid))[0].revoked_at,null);
 good(await rpc(A.admin,'revoke_invite',{p_invite_id:iid}));
});
await check('9 removed member loses access with existing token',async()=>{
 const u=await user('removed'); const id=good(await rpc(A.admin,'invite_member',{p_email:u.email}));
 good(await rpc(u,'accept_invite',{p_invite_id:id,p_display_name:'Removed'}));
 good(await rpc(A.admin,'remove_member',{p_user_id:u.id}));
 assert.deepEqual(good(await rows(u,'health_records','&household_id=eq.'+A.hid)),[]);
 denied(await rpc(u,'log_reading',{p_household_id:A.hid,p_date:'2026-01-04',p_feed_bags:1}));
});
await check('10 unverified account cannot create or accept',async()=>{
 unverified=await publicUser('unverified'); unverified.token=await unverifiedToken(unverified);
 const iid=good(await rpc(A.admin,'invite_member',{p_email:unverified.email}));
 denied(await rpc(unverified,'create_household',{p_care_recipient_name:'No',p_display_name:'No'}));
 denied(await rpc(unverified,'accept_invite',{p_invite_id:iid,p_display_name:'Unverified'}));
});
await check('11 invited email grants nothing until verified; then only A',async()=>{
 assert.deepEqual(good(await rows(unverified,'health_records')),[]);
 const iid=good(await rpc(A.admin,'invite_member',{p_email:unverified.email}));
 good(await request(service,'/auth/v1/admin/users/'+unverified.id,'PUT',{email_confirm:true},{apikey:service}));
 good(await rpc(unverified,'accept_invite',{p_invite_id:iid,p_display_name:'Verified'}));
 assert.equal(good(await rows(unverified,'household_members','&user_id=eq.'+unverified.id))[0].household_id,A.hid);
 assert.deepEqual(good(await rows(unverified,'households','&id=eq.'+B.hid)),[]);
});
await check('12 revoked/expired invites and household_people scope',async()=>{
 const u=await user('expiry'), iid=good(await rpc(A.admin,'invite_member',{p_email:u.email}));
 good(await rpc(A.admin,'revoke_invite',{p_invite_id:iid}));
 denied(await rpc(u,'accept_invite',{p_invite_id:iid,p_display_name:'Expiry'}));
 const expired=good(await rpc(A.admin,'invite_member',{p_email:u.email}));
 sql("UPDATE public.household_invites SET expires_at=now()-interval '1 minute' WHERE id='"+expired+"'");
 denied(await rpc(u,'accept_invite',{p_invite_id:expired,p_display_name:'Expiry'}));
 const people=good(await rpc(B.member,'household_people'));
 assert(people.every(p=>!p.email||p.email===B.admin.email||p.email===B.member.email));
 assert.equal(people.length,2);
});
await check('13 concurrent create/create (20 races)',async()=>{
 for(let i=0;i<20;i++){
  const u=await user('cc'+i), args={p_care_recipient_name:'Race',p_display_name:'Race'};
  const rs=await Promise.all([rpc(u,'create_household',args),rpc(u,'create_household',args)]);
  assert.equal(rs.filter(r=>r.ok).length,1);
  assert.equal(sql("SELECT count(*) FROM public.household_members WHERE user_id='"+u.id+"'"),'1');
  assert.equal(sql("SELECT count(*) FROM public.households WHERE created_by='"+u.id+"'"),'1');
 }
});
await check('14 concurrent create/accept (20 races)',async()=>{
 for(let i=0;i<20;i++){
  const u=await user('ca'+i), iid=good(await rpc(A.admin,'invite_member',{p_email:u.email}));
  const rs=await Promise.all([rpc(u,'create_household',{p_care_recipient_name:'Race',p_display_name:'Race'}),rpc(u,'accept_invite',{p_invite_id:iid,p_display_name:'CA '+i})]);
  assert.equal(rs.filter(r=>r.ok).length,1);
  assert.equal(sql("SELECT count(*) FROM public.household_members WHERE user_id='"+u.id+"'"),'1');
 }
});
await check('15 concurrent accept/revoke (20 races)',async()=>{
 for(let i=0;i<20;i++){
  const u=await user('ar'+i), iid=good(await rpc(A.admin,'invite_member',{p_email:u.email}));
  const rs=await Promise.all([rpc(u,'accept_invite',{p_invite_id:iid,p_display_name:'AR '+i}),rpc(A.admin,'revoke_invite',{p_invite_id:iid})]);
  const inv=good(await rows(A.admin,'household_invites','&id=eq.'+iid))[0];
  assert(!(inv.accepted_at&&inv.revoked_at));
  const count=Number(sql("SELECT count(*) FROM public.household_members WHERE user_id='"+u.id+"'"));
  assert.equal(count,inv.accepted_at?1:0);
  assert(rs.some(r=>r.ok));
 }
});
await check('16 concurrent additive readings on existing and empty days (20 races each)',async()=>{
 for(let i=1;i<=20;i++) for(const existing of [false,true]){
  const date='2026-'+(existing?'03':'02')+'-'+String(i).padStart(2,'0');
  if(existing) good(await insert(A.admin,'health_records',{household_id:A.hid,date,feed_bags:3}));
  const args={p_household_id:A.hid,p_date:date,p_feed_bags:1,p_caregiver_id:A.caregiver,p_recorded_by:'Test'};
  (await Promise.all([rpc(A.admin,'log_reading',args),rpc(A.member,'log_reading',args)])).forEach(good);
  const day=good(await rows(A.admin,'health_records','&date=eq.'+date));
  assert.equal(day.length,1);assert.equal(day[0].feed_bags,existing?5:2);
 }
});
await check('17 concurrent BP inserts and exact average (20 races)',async()=>{
 for(let i=1;i<=20;i++){
  const date='2026-04-'+String(i).padStart(2,'0'), args={p_household_id:A.hid,p_date:date,p_caregiver_id:null,p_recorded_by:'Test'};
  (await Promise.all([rpc(A.admin,'log_bp_reading',{...args,p_systolic:120,p_diastolic:80}),rpc(A.member,'log_bp_reading',{...args,p_systolic:140,p_diastolic:90})])).forEach(good);
  assert.equal(good(await rows(A.admin,'bp_readings','&date=eq.'+date)).length,2);
  const day=good(await rows(A.admin,'health_records','&date=eq.'+date))[0];
  assert.equal(day.bp_systolic,130);assert.equal(day.bp_diastolic,85);
 }
 // Exercise the adjacent BP/feed path too: both operations also update the
 // household ticker, and must not acquire its lock in opposite order.
 for(let i=1;i<=20;i++) {
  const date='2026-06-'+String(i).padStart(2,'0');
  good(await insert(A.admin,'health_records',{household_id:A.hid,date}));
  (await Promise.all([
   rpc(A.admin,'log_bp_reading',{p_household_id:A.hid,p_date:date,p_systolic:120,p_diastolic:80,p_caregiver_id:null,p_recorded_by:'Test'}),
   rpc(A.member,'log_reading',{p_household_id:A.hid,p_date:date,p_feed_bags:1})
  ])).forEach(good);
 }
});
await check('18 audit insert/update/delete, membership keys, actor and immutability',async()=>{
 const note=good(await insert(A.admin,'written_notes',{household_id:A.hid,date:'2026-05-01',content:'Audit'}))[0];
 good(await request(A.admin.token,'/rest/v1/written_notes?id=eq.'+note.id,'PATCH',{content:'Changed'}));
 good(await request(A.admin.token,'/rest/v1/written_notes?id=eq.'+note.id,'DELETE'));
 const events=good(await rows(A.admin,'audit_log','&table_name=eq.written_notes&row_key=eq.'+note.id));
 assert.equal(events.length,3); assert.deepEqual(events.map(e=>e.action).sort(),['delete','insert','update']); assert(events.every(e=>e.actor_user_id===A.admin.id));
 assert.equal(events.find(e=>e.action==='delete').old_row.content,'Changed');
 const household=good(await rows(A.admin,'audit_log','&table_name=eq.households&row_key=eq.'+A.hid));
 assert.equal(household[0].actor_user_id,A.admin.id);
 const memberEvents=good(await rows(A.admin,'audit_log','&table_name=eq.household_members'));
 assert(memberEvents.some(e=>e.action==='insert'&&e.row_key===A.hid+':'+A.member.id&&e.actor_user_id===A.member.id));
 assert(memberEvents.some(e=>e.action==='delete'&&e.actor_user_id===A.admin.id));
 denied(await insert(A.admin,'audit_log',{household_id:A.hid,table_name:'fake',row_key:'fake',action:'insert'}));
 denied(await request(A.admin.token,'/rest/v1/audit_log?id=eq.'+events[0].id,'PATCH',{row_key:'fake'}));
 denied(await request(A.admin.token,'/rest/v1/audit_log?id=eq.'+events[0].id,'DELETE'));
 assert.equal(sql("SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND NOT(schemaname='public' AND tablename='household_sync')"),'0');
});
await check('19 hostile realtime subscriptions with own-family positive control',async()=>{
 const client=u=>createClient(api,anon,{accessToken:async()=>u.token,auth:{persistSession:false,autoRefreshToken:false}});
 const a=client(A.admin), b=client(B.admin), own=[], foreign=[], system=[];
 await Promise.all([a.realtime.setAuth(A.admin.token),b.realtime.setAuth(B.admin.token)]);
 const ca=a.channel('own-'+tag).on('postgres_changes',{event:'*',schema:'public',table:'household_sync',filter:'household_id=eq.'+A.hid},e=>own.push(e));
 const cb=b.channel('hostile-'+tag);
 const bt=b.channel('hostile-ticker-'+tag).on('postgres_changes',{event:'*',schema:'public',table:'household_sync'},e=>foreign.push(e));
 const readyTimers=[];
 const postgresReady=channel=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('PostgreSQL subscription not ready')),10000);
  readyTimers.push(timer);
  channel.on('system',{},e=>{
   system.push(e);
   if(e.extension!=='postgres_changes')return;
   clearTimeout(timer);
   if(e.status==='ok')resolve();else reject(new Error(e.message));
  });
 });
 // Unpublished data-table subscriptions are refused by the server. Await the
 // dedicated hostile ticker separately so those expected refusals cannot make
 // the published-table isolation check vacuous.
 const ready=Promise.all([postgresReady(ca),postgresReady(bt)]);
 const tables=sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").split('\n');
 for(const table of tables) cb.on('postgres_changes',{event:'*',schema:'public',table},e=>foreign.push(e));
 const subscribed=channel=>new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('realtime subscription timed out')),10000);
  channel.subscribe(state=>{
   if(state==='SUBSCRIBED'){clearTimeout(timeout);resolve();}
   else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){clearTimeout(timeout);reject(new Error(state));}
  });
 });
 try {
  await Promise.all([subscribed(ca),subscribed(cb),subscribed(bt)]);
  await ready;
  const note=good(await insert(A.admin,'written_notes',{household_id:A.hid,date:'2026-07-02',content:'Realtime control'}))[0];
  good(await request(A.admin.token,'/rest/v1/written_notes?id=eq.'+note.id,'PATCH',{content:'Updated'}));
  good(await request(A.admin.token,'/rest/v1/written_notes?id=eq.'+note.id,'DELETE'));
  const profileControl=good(await insert(A.admin,'care_profiles',{household_id:A.hid}))[0];
  const alertControl=good(await insert(A.admin,'care_alerts',{household_id:A.hid,kind:'allergy',text:'Realtime synthetic alert'}))[0];
  const contactControl=good(await insert(A.admin,'contacts',{household_id:A.hid,kind:'emergency',name:'Realtime synthetic contact'}))[0];
  const routineControl=good(await insert(A.admin,'routine_items',{household_id:A.hid,kind:'meal',name:'Realtime meal',schedule_time:'8:00 AM',start_date:'2026-01-01'}))[0];
  const routineLog=good(await insert(A.admin,'routine_logs',{household_id:A.hid,item_id:routineControl.id,caregiver_id:A.caregiver,for_date:'2026-01-01',for_minute:480,done_at:new Date().toISOString(),recorded_by:'Synthetic caregiver',kind:'meal',name:'Realtime meal',amount:'all'}))[0];
  for(const [table,row,patch] of [['routine_logs',routineLog,{note:'Updated'}],['routine_items',routineControl,{details:'Updated'}]]) {
   good(await request(A.admin.token,'/rest/v1/'+table+'?id=eq.'+row.id,'PATCH',patch));
   good(await request(A.admin.token,'/rest/v1/'+table+'?id=eq.'+row.id,'DELETE'));
  }
  for(const [table,row,patch] of [['care_alerts',alertControl,{note:'Updated'}],['contacts',contactControl,{role:'Updated'}],['care_profiles',profileControl,{emergency_notes:'Updated'}]]) {
   good(await request(A.admin.token,'/rest/v1/'+table+'?id=eq.'+row.id,'PATCH',patch));
   good(await request(A.admin.token,'/rest/v1/'+table+'?id=eq.'+row.id,'DELETE'));
  }
  const member=await user('realtime-member');
  const invite=good(await rpc(A.admin,'invite_member',{p_email:member.email}));
  good(await rpc(member,'accept_invite',{p_invite_id:invite,p_display_name:'Realtime member'}));
  good(await rpc(A.admin,'remove_member',{p_user_id:member.id}));
  await new Promise(resolve=>setTimeout(resolve,5000));
  assert(own.length>0,'own-family ticker must receive events: '+JSON.stringify(system));
  assert.equal(foreign.length,0,'hostile unfiltered subscriptions must receive no events');
 } finally {readyTimers.forEach(clearTimeout);await Promise.all([a.removeAllChannels(),b.removeAllChannels()]);a.realtime.disconnect();b.realtime.disconnect();}
});
await check('20 explicit NULL deltas preserve totals and flags',async()=>{
 const date='2026-07-01';
 good(await rpc(A.admin,'log_reading',{p_household_id:A.hid,p_date:date,p_feed_bags:3,p_vomit_count:1,p_stool_count:2}));
 good(await rpc(A.admin,'log_reading',{p_household_id:A.hid,p_date:date,p_feed_bags:null,p_bile_bags:null,p_stool_count:null,p_vomit_count:null,p_urine_count:null,p_flush_ml:null,p_flush_count:null}));
 const row=good(await rows(A.admin,'health_records','&date=eq.'+date))[0];
 assert.equal(row.feed_bags,3);assert.equal(row.vomit_count,1);assert.equal(row.stool_count,2);
 assert.equal(row.vomiting,true);assert.equal(row.stool_passed,true);
});
await check('21 removed caregiver rejoins with a new name',async()=>{
 const u=await user('rejoin');
 let iid=good(await rpc(A.admin,'invite_member',{p_email:u.email}));
 good(await rpc(u,'accept_invite',{p_invite_id:iid,p_display_name:'Old name'}));
 const cid=good(await rpc(u,'household_people')).find(p=>p.user_id===u.id).caregiver_id;
 good(await rpc(A.admin,'remove_member',{p_user_id:u.id}));
 good(await insert(A.admin,'caregivers',{household_id:A.hid,display_name:'Old name'}));
 iid=good(await rpc(A.admin,'invite_member',{p_email:u.email}));
 good(await rpc(u,'accept_invite',{p_invite_id:iid,p_display_name:'New name'}));
 const person=good(await rpc(u,'household_people')).find(p=>p.user_id===u.id);
 assert.equal(person.caregiver_id,cid);assert.equal(person.display_name,'New name');assert.equal(person.is_active,true);
});
await check('22 admin cannot forge caregiver account links',async()=>{
 rlsDenied(await insert(A.admin,'caregivers',{household_id:A.hid,display_name:'Forged',user_id:B.admin.id}));
 rlsDenied(await request(A.admin.token,'/rest/v1/caregivers?id=eq.'+A.caregiver,'PATCH',{user_id:B.admin.id}));
 assert.equal(good(await rows(A.admin,'caregivers','&id=eq.'+A.caregiver))[0].user_id,A.admin.id);
 const control=good(await insert(A.admin,'caregivers',{household_id:A.hid,display_name:'Column control'}))[0];
 assert.equal(good(await request(A.admin.token,'/rest/v1/caregivers?id=eq.'+control.id,'PATCH',{display_name:'Changed',is_active:false}))[0].is_active,false);
});
await check('23 future objects default to no client privileges',()=>{
 sql(`BEGIN;
 CREATE TABLE public.privilege_probe(id bigint);
 CREATE SEQUENCE public.privilege_probe_seq;
 CREATE FUNCTION public.privilege_probe_fn() RETURNS integer LANGUAGE sql AS 'SELECT 1';
 DO $probe$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S' ELSE 'r' END::"char",c.relowner))) a
 WHERE c.relname IN ('privilege_probe','privilege_probe_seq') AND a.grantee IN (0,(SELECT oid FROM pg_roles WHERE rolname='anon'),(SELECT oid FROM pg_roles WHERE rolname='authenticated')))
 OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.proname='privilege_probe_fn' AND a.grantee IN (0,(SELECT oid FROM pg_roles WHERE rolname='anon'),(SELECT oid FROM pg_roles WHERE rolname='authenticated')))
 THEN RAISE EXCEPTION 'future objects have client privileges'; END IF;
 END $probe$;
 ROLLBACK;`);
});
await check('24 partial day upsert preserves untouched values and attribution',async()=>{
 const date='2026-07-03';
 const existing=good(await insert(A.admin,'health_records',{
  household_id:A.hid,date,feed_bags:3,stool_count:2,stool_passed:true,
  misc_notes:'Preserve notes',weight:61,caregiver_id:A.caregiver,recorded_by:'Original caregiver',
 }))[0];
 const saved=good(await request(A.member.token,'/rest/v1/health_records?on_conflict=household_id,date','POST',{
  household_id:A.hid,date,weight:62,
 },{Prefer:'resolution=merge-duplicates,return=representation'}))[0];
 assert.equal(saved.id,existing.id);assert.equal(saved.weight,62);
 assert.equal(saved.feed_bags,3);assert.equal(saved.stool_count,2);assert.equal(saved.stool_passed,true);
 assert.equal(saved.misc_notes,'Preserve notes');assert.equal(saved.caregiver_id,A.caregiver);assert.equal(saved.recorded_by,'Original caregiver');
 const created=good(await request(A.admin.token,'/rest/v1/health_records?on_conflict=household_id,date','POST',{
  household_id:A.hid,date:'2026-07-04',weight:60,caregiver_id:A.caregiver,recorded_by:'Original caregiver',
 },{Prefer:'resolution=merge-duplicates,return=representation'}))[0];
 assert.equal(created.feed_bags,0);assert.equal(created.weight,60);assert.equal(created.caregiver_id,A.caregiver);
});
await check('25 transcription quota, concurrency and private usage table',async()=>{
 const deniedClaim=await rpc(B.admin,'claim_transcription',{p_household_id:A.hid});
 assert.equal(deniedClaim.status,400);assert.equal(deniedClaim.data.message,'household_access_denied');
 assert.equal(sql(`SELECT count(*) FROM public.transcription_usage WHERE household_id='${A.hid}'`),'0');
 for(let i=0;i<20;i++) good(await rpc(A.admin,'claim_transcription',{p_household_id:A.hid}));
 const twentyFirst=await rpc(A.member,'claim_transcription',{p_household_id:A.hid});
 assert.equal(twentyFirst.status,400);assert.equal(twentyFirst.data.message,'transcription_limit_reached');
 assert.equal(sql(`SELECT count(*) FROM public.transcription_usage WHERE household_id='${A.hid}' AND user_id='${A.admin.id}'`),'20');
 // Old claims must not consume today's allowance. The SQL is local test setup only.
 sql(`UPDATE public.transcription_usage SET at=now()-interval '25 hours' WHERE household_id='${A.hid}'`);
 const results=await Promise.all(Array.from({length:30},()=>rpc(A.admin,'claim_transcription',{p_household_id:A.hid})));
 assert.equal(results.filter(r=>r.ok).length,20);
 for(const r of results.filter(r=>!r.ok)) {assert.equal(r.status,400);assert.equal(r.data.message,'transcription_limit_reached');}
 assert.equal(sql(`SELECT count(*) FROM public.transcription_usage WHERE household_id='${A.hid}' AND at>=now()-interval '24 hours'`),'20');
 const before=sql(`SELECT count(*) FROM public.transcription_usage`);
 for(const token of [anon,A.admin.token]) {
  const forbidden=[
   await rows(token,'transcription_usage'),
   await insert(token,'transcription_usage',{household_id:A.hid,user_id:A.admin.id}),
   await request(token,'/rest/v1/transcription_usage?household_id=eq.'+A.hid,'PATCH',{at:'2026-01-01T00:00:00Z'}),
   await request(token,'/rest/v1/transcription_usage?household_id=eq.'+A.hid,'DELETE'),
  ];
  for(const r of forbidden) {assert.equal(r.status,token===anon?401:403,JSON.stringify(r));assert.equal(r.data?.code,'42501');}
 }
 assert.equal(sql(`SELECT count(*) FROM public.transcription_usage`),before);
});
await check('26 dose skips are unique, audited, ticker-backed and links are well-formed',async()=>{
 const payload={household_id:A.hid,medicine_id:fixtures.medicines.id,for_date:'2026-06-01',for_minute:600,caregiver_id:A.caregiver,recorded_by:'Synthetic saver'};
 const skip=good(await insert(A.admin,'dose_skips',payload))[0];
 assert.equal(good(await rows(A.admin,'household_sync','&household_id=eq.'+A.hid))[0].table_name,'dose_skips');
 const duplicate=await insert(A.admin,'dose_skips',payload);
 assert.equal(duplicate.status,409);assert.equal(duplicate.data.code,'23505');
 good(await request(A.admin.token,'/rest/v1/dose_skips?id=eq.'+skip.id,'PATCH',{reason:'Not needed'}));
 good(await request(A.admin.token,'/rest/v1/dose_skips?id=eq.'+skip.id,'DELETE'));
 const events=good(await rows(A.admin,'audit_log','&table_name=eq.dose_skips&row_key=eq.'+skip.id));
 assert.deepEqual(events.map(e=>e.action).sort(),['delete','insert','update']);
 assert(events.every(e=>e.actor_user_id===A.admin.id));
 const invalid=[{for_date:'2026-06-01'}, {for_minute:600}, {for_date:'2026-06-01',for_minute:600,is_extra:true}, {for_date:'2026-06-01',for_minute:1440}];
 for(const fields of invalid) {
  const r=await insert(A.admin,'medicine_logs',{household_id:A.hid,date:'2026-06-01',medicine_id:fixtures.medicines.id,...fields});
  assert.equal(r.status,400);assert.equal(r.data.code,'23514');
 }
 assert.deepEqual(good(await rows(A.admin,'medicine_logs','&date=eq.2026-06-01')),[]);
});
await check('27 prescription quota, concurrency and independent allowances',async()=>{
 const P=await family('photo-quota'), Q=await family('audio-first');
 const claim=(u,hid,kind)=>rpc(u,kind==='prescription_read'?'claim_prescription_read':'claim_transcription',{p_household_id:hid});
 const foreign=await claim(B.admin,P.hid,'prescription_read');
 assert.equal(foreign.status,400);assert.equal(foreign.data.message,'household_access_denied');
 assert.equal(sql(`SELECT count(*) FROM public.transcription_usage WHERE household_id='${P.hid}'`),'0');
 const anonymous=await claim(anon,P.hid,'prescription_read');assert.equal(anonymous.status,401);assert.equal(anonymous.data.code,'42501');
 for(const [f,order] of [[P,['prescription_read','transcription']],[Q,['transcription','prescription_read']]]) {
  for(const kind of order) {
   const limit=kind==='transcription'?20:10;
   for(let i=0;i<limit;i++) good(await claim(f.admin,f.hid,kind));
   const extra=await claim(f.member,f.hid,kind);
   assert.equal(extra.status,400);assert.equal(extra.data.message,kind==='transcription'?'transcription_limit_reached':'prescription_limit_reached');
   assert.equal(sql(`SELECT count(*) FROM public.transcription_usage WHERE household_id='${f.hid}' AND kind='${kind}'`),String(limit));
  }
 }
 sql(`UPDATE public.transcription_usage SET at=now()-interval '25 hours' WHERE household_id='${P.hid}'`);
 const results=await Promise.all(Array.from({length:30},()=>claim(P.admin,P.hid,'prescription_read')));
 assert.equal(results.filter(r=>r.ok).length,10);
 for(const r of results.filter(r=>!r.ok)) {assert.equal(r.status,400);assert.equal(r.data.message,'prescription_limit_reached');}
 assert.equal(sql(`SELECT count(*) FROM public.transcription_usage WHERE household_id='${P.hid}' AND kind='prescription_read' AND at>=now()-interval '24 hours'`),'10');
 for(const token of [anon,P.admin.token]) {
  const read=await rows(token,'transcription_usage');assert.equal(read.status,token===anon?401:403);assert.equal(read.data.code,'42501');
  const write=await insert(token,'transcription_usage',{household_id:P.hid,user_id:P.admin.id,kind:'prescription_read'});assert.equal(write.status,token===anon?401:403);assert.equal(write.data.code,'42501');
 }
});
await check('28 prescription function authentication, membership and bounded photos without an AI key',async()=>{
 const jpeg=Buffer.from([255,216,255,224,0,0]);
 const call=async(token,hid=A.hid,count=1,bytes=jpeg)=>{
  const form=new FormData();form.append('household_id',hid);
  for(let i=0;i<count;i++)form.append('photo',new Blob([bytes],{type:'image/jpeg'}),'synthetic.jpg');
  const r=await fetch(api+'/functions/v1/read-prescription',{method:'POST',headers:{apikey:anon,...(token?{Authorization:'Bearer '+token}:{})},body:form});
  return {status:r.status,text:await r.text()};
 };
 assert.equal((await call(null)).status,401);
 for(const count of [1,4]) {const r=await call(A.admin.token,A.hid,count);assert.equal(r.status,500,r.text);assert.equal(JSON.parse(r.text).code,'prescription_not_configured');}
 const refusal=JSON.stringify({error:'Reading is unavailable or you do not have access.'});
 for(const [token,hid] of [[B.admin.token,A.hid],[A.admin.token,'malformed-id']]) {const r=await call(token,hid);assert.equal(r.status,403,r.text);assert.equal(r.text,refusal);}
 for(const [count,bytes] of [[0,jpeg],[5,jpeg],[1,Buffer.from('not JPEG')],[1,Buffer.concat([jpeg,Buffer.alloc(2*1024*1024)])]]) {
  const r=await call(A.admin.token,A.hid,count,bytes);assert.equal(r.status,400,r.text);assert.equal(JSON.parse(r.text).code,'photo_invalid');
 }
 const huge=Buffer.concat([jpeg,Buffer.alloc(9*1024*1024)]);
 const declared=await call(A.admin.token,A.hid,1,huge);assert.equal(declared.status,413,declared.text);
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(5*1024*1024));controller.enqueue(new Uint8Array(5*1024*1024));controller.close();}});
 const undeclared=await fetch(api+'/functions/v1/read-prescription',{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+A.admin.token,'Content-Type':'application/octet-stream'},body:stream,duplex:'half'});
 assert.equal(undeclared.status,413,await undeclared.text());
});
await check('29 client build hints are global authenticated read-only',async()=>{
 const before=sql('SELECT jsonb_agg(t ORDER BY platform)::text FROM public.client_builds t');
 for(const member of [A.admin,B.member]) {
  assert.deepEqual(good(await rows(member,'client_builds')).map(r=>r.platform).sort(),['android','ios']);
  rlsDenied(await insert(member,'client_builds',{platform:'ios',min_build:999}));
  rlsDenied(await request(member.token,'/rest/v1/client_builds?platform=eq.ios','PATCH',{min_build:999}));
  rlsDenied(await request(member.token,'/rest/v1/client_builds?platform=eq.ios','DELETE'));
 }
 const unauth=await rows(anon,'client_builds'); assert.equal(unauth.status,401); assert.equal(unauth.data.code,'42501');
 assert.equal(sql('SELECT jsonb_agg(t ORDER BY platform)::text FROM public.client_builds t'),before);
 assert.equal(sql("SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='client_builds'"),'0');
});
await check('30 profile and contacts isolate families, audit profile keys, and distinguish unknown from none',async()=>{
 const before=Number(sql(`SELECT seq FROM public.household_sync WHERE household_id='${A.hid}'`));
 const profile=good(await insert(A.admin,'care_profiles',{household_id:A.hid,date_of_birth:'1960-10-22'}))[0];
 good(await request(A.member.token,'/rest/v1/care_profiles?id=eq.'+profile.id,'PATCH',{emergency_notes:'Synthetic emergency note'}));
 const alert=good(await insert(A.member,'care_alerts',{household_id:A.hid,kind:'allergy',text:'Synthetic allergy'}))[0];
 const contact=good(await insert(A.admin,'contacts',{household_id:A.hid,kind:'emergency',name:'Synthetic contact',phone:'+15550101234'}))[0];
 const hospital=good(await insert(A.admin,'contacts',{household_id:A.hid,kind:'hospital',name:'Synthetic clinic',address:'123 Sample Street'}))[0];
 const invalidKind=await insert(A.admin,'contacts',{household_id:A.hid,kind:'not-a-group',name:'Invalid group'});assert.equal(invalidKind.data.code,'23514');
 for(const [table,row,body,patch] of [
  ['care_profiles',profile,{household_id:A.hid},{emergency_notes:'foreign'}],
  ['care_alerts',alert,{household_id:A.hid,kind:'allergy',text:'foreign'},{text:'foreign'}],
  ['contacts',contact,{household_id:A.hid,kind:'doctor',name:'foreign'},{name:'foreign'}],
  ['contacts',hospital,{household_id:A.hid,kind:'hospital',name:'foreign clinic'},{address:'foreign'}],
 ]) {
  assert(good(await rows(A.member,table,'&id=eq.'+row.id)).some(r=>r.id===row.id),'rightful member positive control');
  const snapshotBefore=snapshot(table,A.hid);
  assert.deepEqual(good(await rows(B.admin,table,'&household_id=eq.'+A.hid)),[]);
  rlsDenied(await insert(B.admin,table,body));
  assert.deepEqual(good(await request(B.admin.token,'/rest/v1/'+table+'?id=eq.'+row.id,'PATCH',patch)),[]);
  assert.deepEqual(good(await request(B.admin.token,'/rest/v1/'+table+'?id=eq.'+row.id,'DELETE')),[]);
  const anonymous=await rows(anon,table);assert.equal(anonymous.status,401);assert.equal(anonymous.data.code,'42501');
  assert.equal(snapshot(table,A.hid),snapshotBefore);
  assert.equal(sql(`SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='${table}'`),'0');
 }
 good(await request(A.member.token,'/rest/v1/contacts?id=eq.'+contact.id,'PATCH',{role:'Synthetic doctor'}));
 good(await request(A.member.token,'/rest/v1/care_alerts?id=eq.'+alert.id,'PATCH',{note:'Synthetic note'}));
 good(await request(A.member.token,'/rest/v1/contacts?id=eq.'+contact.id,'DELETE'));
 good(await request(A.member.token,'/rest/v1/care_alerts?id=eq.'+alert.id,'DELETE'));
 good(await request(A.member.token,'/rest/v1/care_profiles?id=eq.'+profile.id,'PATCH',{none_known:['allergy']}));
 assert.deepEqual(good(await rows(A.admin,'care_profiles','&id=eq.'+profile.id))[0].none_known,['allergy']);
 const known=good(await insert(A.member,'care_alerts',{household_id:A.hid,kind:'allergy',text:'Actual synthetic alert'}))[0];
 assert.deepEqual(good(await rows(A.admin,'care_profiles','&id=eq.'+profile.id))[0].none_known,[]);
 good(await request(A.admin.token,'/rest/v1/care_profiles?id=eq.'+profile.id,'PATCH',{none_known:['allergy']}));
 assert.deepEqual(good(await rows(A.admin,'care_profiles','&id=eq.'+profile.id))[0].none_known,[]);
 const invalid=await request(A.admin.token,'/rest/v1/care_profiles?id=eq.'+profile.id,'PATCH',{none_known:['invalid']});assert.equal(invalid.data.code,'23514');
 good(await request(A.admin.token,'/rest/v1/care_profiles?id=eq.'+profile.id,'DELETE'));
 const audit=good(await rows(A.admin,'audit_log','&table_name=eq.care_profiles&row_key=eq.'+profile.id));
 assert(audit.some(e=>e.action==='insert'&&e.actor_user_id===A.admin.id));
 assert(audit.some(e=>e.action==='update'&&e.actor_user_id===A.member.id));
 assert(audit.some(e=>e.action==='delete'&&e.actor_user_id===A.admin.id));
 assert(Number(sql(`SELECT seq FROM public.household_sync WHERE household_id='${A.hid}'`))>before);
 good(await request(A.admin.token,'/rest/v1/care_alerts?id=eq.'+known.id,'DELETE'));
});
await check('31 routine plans and records isolate families, enforce kind/FKs, and audit all writes',async()=>{
 const before=Number(sql(`SELECT seq FROM public.household_sync WHERE household_id='${A.hid}'`));
 const itemBody={household_id:A.hid,kind:'meal',name:'Synthetic breakfast',schedule_time:'8:00 AM',start_date:'2026-01-01'};
 const item=good(await insert(A.member,'routine_items',itemBody))[0];
 const logBody={household_id:A.hid,item_id:item.id,caregiver_id:A.caregiver,for_date:'2026-01-01',for_minute:480,done_at:'2026-01-01T13:05:00Z',recorded_by:'Synthetic caregiver',kind:'meal',name:item.name,amount:'all'};
 const log=good(await insert(A.member,'routine_logs',logBody))[0];
 const blockedDelete=await request(A.admin.token,'/rest/v1/routine_items?id=eq.'+item.id,'DELETE');assert.equal(blockedDelete.data.code,'23503');
 const duplicate=await insert(A.admin,'routine_logs',logBody);assert.equal(duplicate.data.code,'23505');
 for(const [table,row,body,patch] of [['routine_items',item,itemBody,{name:'foreign'}],['routine_logs',log,logBody,{note:'foreign'}]]) {
  assert(good(await rows(A.admin,table,'&id=eq.'+row.id)).some(r=>r.id===row.id));
  const beforeRows=snapshot(table,A.hid);
  assert.deepEqual(good(await rows(B.member,table,'&household_id=eq.'+A.hid)),[]);
  rlsDenied(await insert(B.member,table,body));
  assert.deepEqual(good(await request(B.member.token,'/rest/v1/'+table+'?id=eq.'+row.id,'PATCH',patch)),[]);
  assert.deepEqual(good(await request(B.member.token,'/rest/v1/'+table+'?id=eq.'+row.id,'DELETE')),[]);
  assert.equal(snapshot(table,A.hid),beforeRows);
  const anonymous=await rows(anon,table);assert.equal(anonymous.status,401);assert.equal(anonymous.data.code,'42501');
  assert.equal(sql(`SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='${table}'`),'0');
 }
 const foreignItem=good(await insert(B.admin,'routine_items',{...itemBody,household_id:B.hid}))[0];
 for(const bad of [{item_id:foreignItem.id},{caregiver_id:B.caregiver}]) {
  const result=await insert(A.admin,'routine_logs',{...logBody,for_minute:600,...bad});assert.equal(result.data.code,'23503');
 }
 for(const [table,body] of [['routine_items',{...itemBody,target_minutes:10}],['routine_items',{...itemBody,kind:'exercise',target_minutes:10,drink:'Water'}],['routine_logs',{...logBody,for_minute:1440}],['routine_logs',{...logBody,minutes:10}],['routine_logs',{...logBody,kind:'exercise',amount:null,minutes:10,target_minutes:10,drink:'Water'}]]) {
  assert.equal((await insert(A.admin,table,body)).data.code,'23514');
 }
 for(const [table,row,patch] of [['routine_logs',log,{note:'Synthetic correction'}],['routine_items',item,{details:'Synthetic food'}]]) {
  good(await request(A.admin.token,'/rest/v1/'+table+'?id=eq.'+row.id,'PATCH',patch));
  good(await request(A.admin.token,'/rest/v1/'+table+'?id=eq.'+row.id,'DELETE'));
  const audit=good(await rows(A.admin,'audit_log','&table_name=eq.'+table+'&row_key=eq.'+row.id));
  for(const [action,actor] of [['insert',A.member.id],['update',A.admin.id],['delete',A.admin.id]])assert(audit.some(e=>e.action===action&&e.actor_user_id===actor));
 }
 assert(Number(sql(`SELECT seq FROM public.household_sync WHERE household_id='${A.hid}'`))>=before+6);
});
console.log('Failures: '+failures);
process.exitCode=failures;

