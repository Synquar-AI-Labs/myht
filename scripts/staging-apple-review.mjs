// One-off owner-approved sample account. Never part of a test command.
import { readFileSync, writeFileSync, closeSync, openSync, fchmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ref = 'lefqfxkvujqnukgzaviz';
const url = `https://${ref}.supabase.co`;
const env = parseEnv(readFileSync(new URL('../.env.staging.local', import.meta.url), 'utf8'));
if (process.env.STAGING_CONFIRM !== ref || env.VITE_SUPABASE_URL !== url || !env.VITE_SUPABASE_PUBLISHABLE_KEY || /PLACEHOLDER|REPLACE/i.test(env.VITE_SUPABASE_PUBLISHABLE_KEY)) {
  throw new Error('REFUSED: staging URL, public key and STAGING_CONFIRM must match myht-staging.');
}
const path = join(homedir(), 'Documents', 'myht-apple-review-login.txt');
const email = `apple-review-${randomUUID()}@example.com`;
const password = `${randomBytes(32).toString('base64url')}!aA9`;
// Refuse to overwrite existing credentials or create a second account on rerun.
const fd = openSync(path, 'wx', 0o600);
try {
  fchmodSync(fd, 0o600);
  writeFileSync(fd, `MyHT Apple reviewer — staging only\nEmail: ${email}\nPassword: ${password}\nCare recipient: Sample Person\nReviewer caregiver: Sample Family\nAll data is fictional.\n`);
} finally { closeSync(fd); }
const client = createClient(url, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function checked(label, request) {
  const { data, error } = await request;
  if (error) throw new Error(`${label} failed (${error.code ?? 'unknown'}). Stop; do not retry.`);
  return data;
}
const signup = await checked('Account creation', client.auth.signUp({ email, password }));
if (!signup.user || !signup.session) throw new Error('No signed-in session. Stop; do not change email settings.');
console.log(`Created staging reviewer: ${email}`);
const household = await checked('Family creation', client.rpc('create_household', { p_care_recipient_name: 'Sample Person', p_display_name: 'Sample Family', p_timezone: 'America/Toronto' }));
if (!household) throw new Error('No household returned. Stop.');
const people = await checked('Own caregiver lookup', client.rpc('household_people'));
const caregiver = people.find(person => person.user_id === signup.user.id);
if (!caregiver) throw new Error('Own caregiver missing. Stop.');
await checked('Sample medicines', client.from('medicines').insert([
  { household_id: household, name: 'Fictional Amber (sample only)', amount: '1 tablet', frequency: 'daily', schedule_time: '8:00 AM', med_type: 'Tablet', schedule_note: 'Fictional example, not medical advice.' },
  { household_id: household, name: 'Fictional Cedar (sample only)', amount: '5 ml', frequency: 'daily', schedule_time: '8:00 PM', med_type: 'Liquid', schedule_note: 'Fictional example, not medical advice.' },
]));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
await checked('Sample reading', client.rpc('log_reading', { p_household_id: household, p_date: today, p_feed_bags: 1, p_caregiver_id: caregiver.caregiver_id, p_recorded_by: caregiver.display_name }));
const nextDay = new Date(`${today}T12:00:00Z`);
nextDay.setUTCDate(nextDay.getUTCDate() + 1);
await checked('Sample appointment', client.from('appointments').insert({ household_id: household, date: nextDay.toISOString().slice(0, 10), time: '10:00', doctor_name: 'Sample Doctor (fictional)', reason: 'Sample check-up — fictional', address: 'Sample clinic', description: 'Demonstration only. Not a real appointment.' }));
for (const [table, expected] of [['medicines', 2], ['health_records', 1], ['appointments', 1]]) {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true }).eq('household_id', household);
  if (error || count !== expected) throw new Error(`Own sample ${table} verification failed. Stop.`);
}
console.log('Verified own sample household: 2 medicines, 1 daily reading, 1 appointment.');
console.log(`Credentials saved privately: ${path}`);
