import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { test, expect, family, checked, person, signIn, today, tomorrow } from './helpers';
import type { Page } from '@playwright/test';

const sizes = [[320,568],[360,800],[375,667],[393,852],[412,915],[430,932],[844,390],[600,960],[768,1024],[800,1280],[820,1180],[1024,768],[1280,800],[1366,1024]];
const phase = process.env.SCREEN_PHASE === 'before' ? 'before' : 'after';
type Finding = { type: string; element: string; detail: string };
const results: { screen: string; viewport: string; scale: number; path: string; findings: Finding[] }[] = [];
let seeded: Awaited<ReturnType<typeof family>>;
let newPerson: Awaited<ReturnType<typeof person>>;

test.beforeAll(async () => {
  seeded = await family();
  newPerson = await person('Setup helper');
  const caregiver = seeded.people.find(p => p.user_id === seeded.admin.id)!;
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', hour: 'numeric', hour12: false }).format(new Date())) % 24;
  const upcoming = (hour + 2) % 24;
  const label = `${upcoming % 12 || 12}:00 ${upcoming < 12 ? 'AM' : 'PM'}`;
  for (const name of ['Synthetic morning medicine', 'Synthetic evening medicine', 'Synthetic as-needed medicine']) {
    const medicine = await checked(seeded.admin.client.from('medicines').insert({ household_id: seeded.id, name, amount: '1 tablet', frequency: 'daily', schedule_time: label }).select().single());
    await checked(seeded.admin.client.from('medicine_logs').insert({ household_id: seeded.id, medicine_id: medicine.id, date: today(), hour: hour % 12 || 12, am_pm: hour < 12 ? 'AM' : 'PM', caregiver_id: caregiver.caregiver_id, recorded_by: caregiver.display_name }));
  }
  await checked(seeded.admin.client.rpc('log_reading', { p_household_id: seeded.id, p_date: today(), p_feed_bags: 3, p_urine_count: 2, p_vomit_count: 1, p_flush_ml: 500, p_caregiver_id: caregiver.caregiver_id, p_recorded_by: caregiver.display_name }));
  await checked(seeded.admin.client.rpc('log_bp_reading', { p_household_id: seeded.id, p_date: today(), p_systolic: 120, p_diastolic: 80, p_caregiver_id: caregiver.caregiver_id, p_recorded_by: caregiver.display_name }));
  await checked(seeded.admin.client.from('appointments').insert({ household_id: seeded.id, date: tomorrow(), time: '15:30', doctor_name: 'Synthetic specialist', reason: 'Follow-up care planning', address: 'Synthetic clinic' }));
  await checked(seeded.admin.client.from('hospital_stays').insert({ household_id: seeded.id, caregiver_id: caregiver.caregiver_id, person_name: caregiver.display_name, date: today(), start_hour: 9, end_hour: 24 }));
  await checked(seeded.admin.client.from('written_notes').insert({ household_id: seeded.id, date: today(), title: 'Synthetic shift note', content: 'Discuss the next appointment and feeding plan.', recorded_by: caregiver.display_name, caregiver_id: caregiver.caregiver_id }));
});

async function inspect(page: Page): Promise<Finding[]> {
  return page.evaluate(() => {
    const findings: Finding[] = [];
    const width = document.documentElement.clientWidth;
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      return el.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !el.closest('[aria-hidden="true"], [inert]') && !el.classList.contains('sr-only');
    };
    const identify = (el: Element) => `${el.tagName.toLowerCase()} ${el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 90) || el.getAttribute('placeholder') || el.getAttribute('type') || ''}`;
    const scrollParent = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true;
      return false;
    };
    if (document.documentElement.scrollWidth > width + 1) findings.push({ type: 'page-overflow', element: 'document', detail: `${document.documentElement.scrollWidth}px > ${width}px` });
    const all = [...document.querySelectorAll('body *')].filter(visible);
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1 || ['SCRIPT','STYLE','SVG','PATH'].includes(el.tagName)) continue;
      if ((rect.left < -1 || rect.right > width + 1) && !scrollParent(el)) findings.push({ type: 'element-overflow', element: identify(el), detail: `left ${Math.round(rect.left)}, right ${Math.round(rect.right)}` });
      if (el.matches('button,a[href],input:not([type=hidden]),textarea,select,[role=button],[role=combobox]')) {
        // A native associated label is also a pointer target for switches/checkboxes.
        const id = el.id;
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
        const lr = label?.getBoundingClientRect();
        if ((rect.width < 43.9 || rect.height < 43.9) && !(lr && lr.width >= 44 && lr.height >= 44)) findings.push({ type: 'small-target', element: identify(el), detail: `${Math.round(rect.width)}×${Math.round(rect.height)}px` });
      }
      const style = getComputedStyle(el);
      if (el.textContent?.trim() && !el.matches('input,textarea')) {
        if ((el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && /(hidden|clip)/.test(style.overflow + style.overflowX + style.overflowY)) findings.push({ type: 'clipped-text', element: identify(el), detail: `content ${el.scrollWidth}×${el.scrollHeight}, box ${el.clientWidth}×${el.clientHeight}` });
      }
      if (el.matches('[role=dialog]') && (rect.top < -1 || rect.bottom > innerHeight + 1)) findings.push({ type: 'clipped-text', element: identify(el), detail: `dialog extends outside viewport: top ${Math.round(rect.top)}, bottom ${Math.round(rect.bottom)}, viewport ${innerHeight}` });
    }
    return findings;
  });
}

async function capture(page: Page, screen: string, viewport: string, scale: number) {
  if (scale === 130) await page.evaluate(() => {
    const elements = [...document.querySelectorAll<HTMLElement>('body *')];
    const fonts = elements.map(el => parseFloat(getComputedStyle(el).fontSize));
    elements.forEach((el, i) => {
      el.dataset.auditFont = el.style.fontSize;
      el.style.fontSize = `${fonts[i] * 1.3}px`;
    });
    document.documentElement.style.fontSize = '130%';
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, 0));
  const findings = await inspect(page);
  // Check the last control at maximum scroll, not just its initial offscreen position.
  const hidden = await page.evaluate(() => {
    const nav = [...document.querySelectorAll('nav')].find(el => getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().height > 0);
    if (!nav || document.querySelector('[role=dialog]')) return null;
    window.scrollTo(0, document.documentElement.scrollHeight);
    const controls = [...document.querySelectorAll('main button,main input,main textarea,main a[href]')].filter(el => el.getClientRects().length && !el.closest('[aria-hidden=true]'));
    const last = controls.at(-1);
    if (!last) return null;
    const r = last.getBoundingClientRect();
    return r.bottom > nav.getBoundingClientRect().top + 1 ? (last.textContent || last.getAttribute('aria-label') || last.tagName) : null;
  });
  if (hidden) findings.push({ type: 'bottom-bar', element: hidden, detail: 'last control overlaps fixed navigation at maximum page scroll' });
  await page.evaluate(() => window.scrollTo(0, 0));
  const suffix = scale === 130 ? '-text130' : '';
  const dir = `test-results/screens/${viewport}`;
  await mkdir(`${dir}/${phase}`, { recursive: true });
  const path = `${viewport}/${phase}/${screen}${suffix}.png`;
  await page.screenshot({ path: `test-results/screens/${path}`, fullPage: true, animations: 'disabled' });
  if (phase === 'after') await page.screenshot({ path: `${dir}/${screen}${suffix}.png`, fullPage: true, animations: 'disabled' });
  results.push({ screen, viewport, scale, path, findings });
  if (scale === 130) await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('[data-audit-font]').forEach(el => {
      el.style.fontSize = el.dataset.auditFont || '';
      delete el.dataset.auditFont;
    });
    document.documentElement.style.fontSize = '';
  });
}

for (const [width,height] of sizes) test(`${width}x${height} screen audit`, async ({ page, sessions }) => {
  void sessions;
  await page.setViewportSize({ width, height });
  for (const scale of [100,130]) {
    await page.goto('/auth');
    await capture(page, 'first-screen', `${width}x${height}`, scale);
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
    await capture(page, 'create-account', `${width}x${height}`, scale);
    await page.getByLabel('Your name', { exact: true }).fill('Screen helper');
    await page.getByLabel('Email', { exact: true }).fill(`screen-${width}-${height}-${scale}-${Date.now()}@example.local`);
    await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-42!');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await capture(page, 'code-screen', `${width}x${height}`, scale);
    await signIn(page, newPerson, undefined, false);
    await expect(page.getByRole('heading', { name: 'Who are you caring for?' })).toBeVisible();
    await capture(page, 'care-setup', `${width}x${height}`, scale);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
    await signIn(page, seeded.admin, undefined, false);
    await expect(page.getByText(/Given · last 12 hours/)).toBeVisible();
    await capture(page, 'today', `${width}x${height}`, scale);
    await page.getByRole('button', { name: /^Record a reading/ }).click();
    await capture(page, 'reading-tiles', `${width}x${height}`, scale);
    await page.getByRole('button', { name: /^Feed / }).click();
    await capture(page, 'reading-sheet', `${width}x${height}`, scale);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: /^Record a medicine/ }).click();
    await capture(page, 'medicine-list', `${width}x${height}`, scale);
    await page.locator('.collapsible-content[data-state="open"]').getByRole('button', { name: /^Synthetic morning medicine/ }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Log Synthetic morning medicine', exact: true })).toBeVisible();
    await capture(page, 'dose-sheet', `${width}x${height}`, scale);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit this day' })).toBeVisible();
    await capture(page, 'history', `${width}x${height}`, scale);
    await page.getByRole('button', { name: 'Edit this day' }).click();
    await expect(page.getByText('Feed Bags', { exact: true })).toBeVisible();
    await expect(page.getByText('Feed Bags', { exact: true }).locator('..').locator('input')).toHaveValue('3');
    await capture(page, 'edit-day', `${width}x${height}`, scale);
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await capture(page, 'more', `${width}x${height}`, scale);
    for (const [destination,screen] of [['Medicine cabinet','medicine-cabinet'],['Doctor visits','doctor-visits'],['Hospital stays','hospital-stays'],['Doctor conversations','doctor-conversations'],['Reports & downloads','reports'],['Family & people','family-people']]) {
      await page.getByRole('button', { name: new RegExp('^' + destination) }).click();
      await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
      await capture(page, screen, `${width}x${height}`, scale);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
    }
    await page.getByRole('button', { name: /^Sign out/ }).click();
    await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
  }
});

test.afterAll(async () => {
  await mkdir('test-results/screens', { recursive: true });
  await writeFile(`test-results/screens/${phase}.json`, JSON.stringify(results, null, 2));
  const counts = results.flatMap(r => r.findings).reduce((acc, f) => ({ ...acc, [f.type]: (acc[f.type] || 0) + 1 }), {} as Record<string, number>);
  const sorted = [...results].sort((a,b) => a.screen.localeCompare(b.screen) || sizes.findIndex(s => s.join('x') === a.viewport) - sizes.findIndex(s => s.join('x') === b.viewport) || a.scale-b.scale);
  await writeFile('test-results/screens/report.md', `# Screen audit (${phase})\n\nChromium CSS viewports; synthetic local data only. Text 130% scales every computed font (including fixed px typography) plus the root size; it is a stress test, not an iOS font-setting emulator. Findings are candidates, not automatic defect verdicts; intentional truncation, chart internals and compact calendar controls need human review.\n\nCounts: ${JSON.stringify(counts)}\n\n` + sorted.map(r => `## ${r.screen} — ${r.viewport}, text ${r.scale}%\n\n[Full screenshot](${r.path})\n\n${r.findings.length ? r.findings.map(f => `- ${f.type}: ${f.element.replace(/\n/g,' ')} — ${f.detail}`).join('\n') : 'No automated findings.'}\n`).join('\n'));
  const escape = (s: string) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  let before: typeof results = [];
  if (phase === 'after') {
    try { before = JSON.parse(await readFile('test-results/screens/before.json', 'utf8')); } catch { /* First run has no baseline. */ }
  }
  await writeFile('test-results/screens/index.html', `<meta charset="utf-8"><title>Local screen audit</title><style>body{font:16px system-ui;background:#eee}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}img{width:100%;max-height:500px;object-fit:contain;object-position:top}article{background:white;padding:12px}.pair{display:flex;gap:8px}.pair a{width:50%}</style><h1>${phase} screen audit</h1><a href="report.md">Findings</a><main>${sorted.map(r => {
    const old = before.find(b => b.screen === r.screen && b.viewport === r.viewport && b.scale === r.scale);
    return `<article><h2>${escape(r.screen)}</h2><p>${r.viewport} · ${r.scale}% · ${old ? old.findings.length + ' → ' : ''}${r.findings.length} findings</p><div class="pair">${old ? `<a href="${old.path}">Before<img loading="lazy" src="${old.path}"></a>` : ''}<a href="${r.path}">${phase}<img loading="lazy" src="${r.path}"></a></div></article>`;
  }).join('')}</main>`);
  console.log(`SCREEN COUNTS ${phase}: ${JSON.stringify(counts)}; ${results.length} captures`);
});
