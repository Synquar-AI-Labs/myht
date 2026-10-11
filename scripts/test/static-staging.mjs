import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
import { scanArtifact } from '../staging-artifact.mjs';

scanArtifact('dist-staging');
const root = resolve('dist-staging');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  let file = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + '/')) file = root + '/index.html';
  try { if (!statSync(file).isFile()) file = root + '/index.html'; }
  catch { file = root + '/index.html'; }
  res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const page = await context.newPage();
  for (const path of ['/', '/auth']) {
    const response = await page.goto(origin + path);
    if (response.status() !== 200) throw new Error(`${path} was not 200`);
    await page.getByRole('button', { name: 'Create an account', exact: true }).waitFor({ state: 'visible' });
    console.log(`PASS static ${path}: HTTP 200, account screen rendered (all remote requests blocked)`);
  }
  console.log('PASS client target: ' + scanArtifact('dist-staging').host);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
