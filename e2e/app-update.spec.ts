import { test, expect, family, password, reading, today, checked } from './helpers';
import { localStack } from './local';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';

let server: Server, root: string, origin: string;
let version: { commit: string; builtAt: string }, next: typeof version | undefined;
let navigations = 0;
test.beforeAll(async () => {
  const stack = localStack(); // Exact local-only URL guard, never .env's live target.
  root = mkdtempSync(resolve(tmpdir(), 'myht-update-'));
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', root, '--emptyOutDir'], {
    env: { ...process.env, VITE_SUPABASE_URL: stack.API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: stack.ANON_KEY, VITE_SUPABASE_PROJECT_ID: 'myht' }, stdio: 'pipe',
  });
  version = JSON.parse(readFileSync(root + '/version.json', 'utf8'));
  server = createServer((req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (path === '/version.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(next ?? version)); return; }
    let file = resolve(root, '.' + path);
    try { if (!file.startsWith(root + '/') || !statSync(file).isFile()) file = root + '/index.html'; }
    catch { file = root + '/index.html'; }
    if (file.endsWith('/index.html')) { navigations++; if (navigations > 1) next = undefined; }
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' } as Record<string, string>)[extname(file)] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => { if (server) await new Promise<void>(done => server.close(() => done())); if (root) rmSync(root, { recursive: true, force: true }); });

test('o. Production updates reload idle pages, wait for open forms, then reload when work ends', async ({ page, sessions }) => {
  void sessions;
  navigations = 0;
  await page.goto(origin + '/auth');
  await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
  next = { ...version, builtAt: 'synthetic-next-build' };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => navigations).toBe(2);
  await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'I already have an account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Email').fill('synthetic@example.local');
  next = { ...version, builtAt: 'synthetic-third-build' };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('A new version is ready', { exact: true })).toBeVisible();
  expect(navigations).toBe(2);
  await expect(page.getByLabel('Email')).toHaveValue('synthetic@example.local');
  for (const [width, height] of [[393, 852], [800, 1280]]) {
    await page.setViewportSize({ width, height });
    for (const scale of [100, 130]) {
      await page.evaluate(scale => document.documentElement.style.fontSize = `${16 * scale / 100}px`, scale);
      await page.screenshot({ path: `test-results/dose-resolution/${width}x${height}/update-bar${scale === 130 ? '-text130' : ''}.png`, fullPage: true });
    }
  }
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  await page.getByRole('button', { name: 'Update now', exact: true }).click();
  await expect(page.getByText("Finish this first. The app will update when you're done.", { exact: true })).toBeVisible();
  expect(navigations).toBe(2);
  await expect(page.getByLabel('Email')).toHaveValue('synthetic@example.local');
  // Closing the form finishes the work; no manual update click is needed.
  await page.getByRole('button', { name: /Back$/ }).click();
  await expect.poll(() => navigations).toBe(3);
  await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
});

test('q. Production updates wait for a reading write to finish', async ({ page, sessions }) => {
  void sessions;
  const f = await family();
  navigations = 0;
  next = undefined;
  await page.goto(origin + '/auth');
  await page.getByRole('button', { name: 'I already have an account' }).click();
  await page.getByLabel('Email', { exact: true }).fill(f.admin.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Record a reading/ })).toBeVisible();
  let release!: () => void;
  let started = false;
  const gate = new Promise<void>(done => { release = done; });
  await page.route('**/rest/v1/rpc/log_reading', async route => {
    started = true;
    await gate;
    await route.continue();
  });
  try {
    const drawer = await reading(page, 'Feed');
    await drawer.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => started).toBe(true);
    await expect(drawer.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
    next = { ...version, builtAt: 'synthetic-reading-build' };
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByText('A new version is ready', { exact: true })).toBeVisible();
    expect(navigations).toBe(1);
    release();
    await expect.poll(async () => (await checked(f.admin.client.from('health_records').select('feed_bags').eq('household_id', f.id).eq('date', today())))?.[0]?.feed_bags).toBe(1);
    await expect.poll(() => navigations, { timeout: 15_000 }).toBe(2);
    await page.getByRole('button', { name: /^Record a reading/ }).click();
    await expect(page.getByRole('button', { name: 'Feed 1 today', exact: true })).toBeVisible();
  } finally {
    release();
    await page.unroute('**/rest/v1/rpc/log_reading');
  }
});
