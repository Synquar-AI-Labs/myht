import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { localStack, API_URL, MAIL_URL } from './local';

const stack = localStack();
export const password = 'Synthetic-password-42!';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
export const tomorrow = () => {
  const date = new Date(today() + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};
export const uniqueEmail = (label: string) => `${label}-${randomUUID()}@example.local`;
export const client = (key = stack.ANON_KEY) => createClient(API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
export type Person = { id: string; email: string; name: string; client: SupabaseClient };
export async function checked<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await request;
  expect(error).toBeNull();
  return data;
}
export async function person(name: string, confirmed = true): Promise<Person> {
  const email = uniqueEmail('person');
  const auth = client();
  let id: string;
  if (confirmed) {
    const data = await checked(client(stack.SERVICE_ROLE_KEY).auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } }));
    id = data.user!.id;
    await checked(auth.auth.signInWithPassword({ email, password }));
  } else {
    const data = await checked(auth.auth.signUp({ email, password, options: { data: { display_name: name } } }));
    id = data.user!.id;
  }
  return { id, email, name, client: auth };
}
export async function family() {
  const admin = await person('Admin person');
  const id = await checked(admin.client.rpc('create_household', { p_care_recipient_name: 'Synthetic recipient', p_display_name: admin.name, p_timezone: 'America/Toronto' }));
  const member = await person('Member person');
  const invitation = await checked(admin.client.rpc('invite_member', { p_email: member.email }));
  await checked(member.client.rpc('accept_invite', { p_invite_id: invitation, p_display_name: member.name }));
  const people = await checked(admin.client.rpc('household_people'));
  return { id: id as string, admin, member, people: people as { caregiver_id: string; user_id: string; display_name: string }[] };
}
export const test = base.extend<{ sessions: () => Promise<Page> }>({
  sessions: async ({ browser, page, context }, use, info) => {
    const extra: BrowserContext[] = [];
    const errors: string[] = [];
    const guard = async (ctx: BrowserContext) => {
      await ctx.route('**/*', route => {
        const url = new URL(route.request().url());
        return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
      });
      ctx.on('page', p => p.on('pageerror', e => errors.push(e.message)));
    };
    await guard(context);
    page.on('pageerror', e => errors.push(e.message));
    await use(async () => {
      const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:5187', viewport: { width: 390, height: 844 }, timezoneId: 'America/Toronto' });
      extra.push(ctx); await guard(ctx);
      return ctx.newPage();
    });
    if (info.status !== info.expectedStatus || errors.length) {
      for (const [i, ctx] of extra.entries()) {
        for (const [j, p] of ctx.pages().entries()) await p.screenshot({ path: info.outputPath(`extra-session-${i}-${j}.png`), fullPage: true });
      }
    }
    for (const ctx of extra) await ctx.close();
    expect(errors, 'unhandled browser errors').toEqual([]);
  },
});
export { expect };

export async function mailCode(email: string, after = 0) {
  let code = '';
  await expect(async () => {
    const response = await fetch(MAIL_URL + '/api/v1/messages?limit=100');
    expect(response.ok).toBeTruthy();
    const inbox = await response.json();
    const message = inbox.messages.find((m: { To: { Address: string }[]; Created: string }) => m.To.some(to => to.Address === email) && Date.parse(m.Created) >= after);
    expect(message, 'local email for ' + email).toBeTruthy();
    code = message.Snippet.match(/\b\d{6}\b/)?.[0] ?? '';
    expect(code).toMatch(/^\d{6}$/);
  }).toPass({ timeout: 15_000 });
  return code;
}
export async function enterCode(page: Page, code: string) {
  const input = page.getByRole('textbox', { name: '6-digit code' });
  await input.fill('');
  await input.fill(code);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}
export async function signUp(page: Page, name: string, email: string) {
  await page.goto('/auth');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
}
export async function signIn(page: Page, user: Person, pass = password, ready = true) {
  await page.goto('/auth');
  await page.getByRole('button', { name: 'I already have an account' }).click();
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  if (ready) await expect(page.getByRole('button', { name: /^Record a reading/ })).toBeVisible();
}
export async function finishFamily(page: Page) {
  await expect(page.getByRole('heading', { name: 'Who are you caring for?' })).toBeVisible();
  await page.getByLabel('Their name', { exact: true }).fill('Synthetic recipient');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Who else helps?' })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Record a reading/ })).toBeVisible();
}
export async function more(page: Page, destination: string) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: new RegExp('^' + destination) }).click();
}
export async function reading(page: Page, name: string) {
  const tile = page.getByRole('button', { name: new RegExp('^' + name + ' ') });
  if (!(await tile.isVisible())) await page.getByRole('button', { name: /^Record a reading/ }).click();
  await tile.click();
  return page.getByRole('dialog');
}
export async function choose(page: Page, trigger: ReturnType<Page['getByRole']>, name: string) {
  await trigger.click();
  await page.getByRole('option', { name, exact: true }).click();
}
export async function insertMedicine(user: Person, household: string, name = 'Synthetic medicine') {
  return (await checked(user.client.from('medicines').insert({ household_id: household, name, amount: '1 tablet', frequency: 'as_needed' }).select().single())) as { id: string; name: string };
}
