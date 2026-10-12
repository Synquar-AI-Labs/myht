// One-off, owner-approved check only. Never part of a test command.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { validatePrescription } from '../supabase/functions/read-prescription/validation.ts';

const ref = 'lefqfxkvujqnukgzaviz';
const url = `https://${ref}.supabase.co`;
const env = parseEnv(readFileSync(new URL('../.env.staging.local', import.meta.url), 'utf8'));
if (process.env.STAGING_CONFIRM !== ref || env.VITE_SUPABASE_URL !== url) {
  console.error('REFUSED: staging URL and STAGING_CONFIRM must match myht-staging exactly.');
  process.exit(1);
}
if (!env.VITE_SUPABASE_PUBLISHABLE_KEY || /PLACEHOLDER|REPLACE/i.test(env.VITE_SUPABASE_PUBLISHABLE_KEY)) {
  console.error('REFUSED: staging publishable key is missing.'); process.exit(1);
}
const fields = ['name', 'strength', 'amount', 'days', 'every_days', 'times_per_day', 'every_hours', 'instructions', 'duration', 'photos'];
const medicine = (name, strength, amount, extra = {}) => ({ name, strength, amount, days: 'daily', every_days: null, times_per_day: 1, every_hours: null, instructions: '', duration: '', photos: [1], ...extra });
const prescription = [
  medicine('Fictional Amber', '5 mg', '1 tablet', { times_per_day: 2, instructions: 'with food', duration: 'for 7 days' }),
  medicine('Fictional Cedar', '10 mg', '2 tablets', { days: 'every_n_days', every_days: 3, times_per_day: null }),
  medicine('Fictional Violet', '20 mg', '1 capsule', { days: 'as_needed', times_per_day: null, instructions: 'as needed' }),
];
const label = [medicine('Fictional Willow', '15 mg', '1 tablet', { every_hours: 12, times_per_day: null, instructions: 'with food', duration: 'for 5 days', photos: [1, 2, 3] })];
// Render synthetic content only; block every browser network request.
const browser = await chromium.launch({ headless: true });
let samples;
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.route('**/*', route => route.abort());
  const style = '<style>body{margin:0;padding:48px;box-sizing:border-box;font:32px Arial;background:white;color:black}h1{font-size:44px}p{margin:24px 0}</style>';
  const lines = [
    'Fictional Amber 5 mg — Take 1 tablet 2 times a day with food for 7 days.',
    'Fictional Cedar 10 mg — Take 2 tablets every 3 days.',
    'Fictional Violet 20 mg — Take 1 capsule as needed.',
  ];
  await page.setContent(style + '<h1>FICTIONAL PRESCRIPTION — TEST ONLY</h1><p>Patient: Invented Patient · Doctor: Invented Doctor</p>' + lines.map(line => `<p>${line}</p>`).join(''));
  const printed = await page.screenshot({ type: 'jpeg', quality: 90 });
  await page.setViewportSize({ width: 1600, height: 500 });
  const labelLines = ['FICTIONAL PHARMACY LABEL — TEST ONLY', 'Invented Patient · Invented Doctor', 'Fictional Willow 15 mg', 'Take 1 tablet every 12 hours with food for 5 days.'];
  await page.setContent(style + '<style>body{font-size:42px}</style>' + labelLines.map(line => `<p>${line}</p>`).join(''));
  const turned = [];
  for (const x of [0, 440, 880]) turned.push(await page.screenshot({ type: 'jpeg', quality: 90, clip: { x, y: 0, width: 720, height: 500 } }));
  samples = [{ title: 'Printed prescription', images: [printed], expected: prescription, printed: lines }, { title: 'Overlapping pharmacy label', images: turned, expected: label, printed: labelLines }];
} finally { await browser.close(); }

const client = createClient(url, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `photo-read-${randomUUID()}@example.com`;
const password = `${randomUUID()}!Aa9`;
const signup = await client.auth.signUp({ email, password });
if (signup.data.user) console.log(`Throwaway account: ${email}`);
if (signup.error || !signup.data.session) throw new Error('Account creation did not return a session. Stop; do not retry or change email settings.');
const created = await client.rpc('create_household', { p_care_recipient_name: 'Photo read check', p_display_name: 'Photo check person', p_timezone: 'America/Toronto' });
if (created.error || !created.data) throw new Error('Family creation failed. Stop; do not retry.');
for (const sample of samples) {
  const body = new FormData(); body.append('household_id', created.data);
  sample.images.forEach((image, i) => body.append('photo', new Blob([image], { type: 'image/jpeg' }), `synthetic-${i + 1}.jpg`));
  const response = await client.functions.invoke('read-prescription', { body });
  if (response.error) throw new Error(`${sample.title}: read failed. Stop; no retry was made.`);
  const result = validatePrescription(response.data, sample.images.length);
  console.log(`\n${sample.title}\nActually printed:\n${sample.printed.join('\n')}`);
  console.log('Validated answer:', JSON.stringify(result, null, 2));
  console.log(`Expected ${sample.expected.length} medicine(s); returned ${result.medicines.length}. Prescription: ${result.is_prescription}`);
  for (const [index, expected] of sample.expected.entries()) {
    const answer = result.medicines.find(row => row.name.toLowerCase() === expected.name.toLowerCase()) ?? result.medicines[index];
    console.table(fields.map(field => ({ field, printed: JSON.stringify(expected[field]), returned: JSON.stringify(answer?.[field]), matches: JSON.stringify(expected[field]) === JSON.stringify(answer?.[field]) })));
    console.log('Copied source:', answer?.source_text ?? '(no result)', 'Check fields:', answer?.unsure ?? []);
  }
}
console.log(`Done. Account kept for inspection: ${email}. No medicines were added to the cabinet.`);
