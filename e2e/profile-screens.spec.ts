import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, family, checked, signIn, more } from './helpers';

const sizes = [[320, 568], [360, 800], [393, 852], [800, 1280], [1280, 800]];
for (const [width, height] of sizes) test(`${width}x${height} profile and contacts screens`, async ({ page, sessions }) => {
  void sessions;
  await page.setViewportSize({ width, height });
  const f = await family();
  await signIn(page, f.admin); await more(page, 'About ');
  const folder = `test-results/profile/${width}x${height}`;
  mkdirSync(folder, { recursive: true });
  const capture = async (name: string) => {
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await expect(async () => {
      const problems = await page.evaluate(() => {
      const errors: string[] = [];
      if (document.documentElement.scrollWidth > innerWidth + 1) errors.push('horizontal page overflow');
      for (const element of document.querySelectorAll<HTMLElement>('button,a[href],input:not([type=file]),textarea,select')) {
        if (!element.getClientRects().length || element.closest('[aria-hidden=true]')) continue;
        const rect = element.getBoundingClientRect();
        if (rect.left < -1 || rect.right > innerWidth + 1) errors.push('control outside viewport');
        if (rect.width < 43.9 || rect.height < 43.9) errors.push(`small control: ${element.textContent || element.getAttribute('aria-label')} ${rect.width}x${rect.height}`);
      }
      return errors;
      });
      expect(problems).toEqual([]);
    }).toPass({ timeout: 5000 });
    await page.screenshot({ path: `${folder}/${name}.png`, fullPage: true });
  };
  await expect(page.getByText('Date of birth: Not recorded')).toBeVisible();
  await capture('about-unknown');
  await page.getByRole('button', { name: 'Emergency card', exact: true }).click();
  await expect(page.locator('[data-emergency-card]')).toBeVisible();
  await capture('emergency-unknown');
  await checked(f.admin.client.from('care_profiles').upsert({ household_id: f.id, date_of_birth: '1960-10-22', fall_risk: true, fall_risk_note: 'Two people to stand', emergency_notes: 'Sample emergency note. Speak clearly; sample hearing aid.' }, { onConflict: 'household_id' }));
  await checked(f.admin.client.from('care_alerts').insert([
    { household_id: f.id, kind: 'allergy', text: 'Peanuts', note: '' }, { household_id: f.id, kind: 'allergy', text: 'Latex', note: '' },
    { household_id: f.id, kind: 'contagious', text: 'Sample infection', note: 'Sample precautions' },
    { household_id: f.id, kind: 'condition', text: 'Sample condition', note: '' }, { household_id: f.id, kind: 'diet', text: 'Cut food into small pieces', note: '' },
  ]));
  await checked(f.admin.client.from('contacts').insert([
    { household_id: f.id, kind: 'emergency', name: 'First sample contact', role: 'First to call', phone: '+1 (555) 010-1234' },
    { household_id: f.id, kind: 'doctor', name: 'Sample doctor', role: 'Family doctor', phone: '+1 (555) 010-5678' },
    { household_id: f.id, kind: 'caretaker', name: 'Sample helper', role: 'Nurse', phone: '+1 (555) 010-2345' },
    { household_id: f.id, kind: 'other', name: 'Sample pharmacy', role: 'Refills', phone: '+1 (555) 010-3456' },
  ]));
  await checked(f.admin.client.from('medicines').insert({ household_id: f.id, name: 'Synthetic tablet', potency: '5 mg', amount: '1 tablet', schedule_time: '8:00 AM / 8:00 PM', frequency: 'daily' }));
  await expect(page.locator('[data-emergency-card]')).toContainText('Synthetic tablet');
  await expect(page.locator('[data-emergency-card]')).toContainText('First sample contact');
  await capture('emergency');
  await page.getByRole('button', { name: 'About Synthetic recipient', exact: true }).click();
  await expect(page.getByText('Peanuts', { exact: true })).toBeVisible();
  await capture('about');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture('about-edit');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Contacts', exact: true }).click();
  await expect(page.getByText('Sample doctor', { exact: true })).toBeVisible();
  await capture('contacts');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await capture('contact-edit');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.locator('[data-today-alerts]')).toContainText('+2 more');
  const lines = page.locator('[data-alert-lines]');
  expect(await lines.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(40.5);
  await capture('today-alerts');
  // The existing bedside/presentation entry is offered on tablet/desktop.
  // Enter at the intended dimensions: Chromium cannot resize a fullscreen window.
  if (width >= 768) {
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: /^Presentation mode/ }).click();
    await expect(page.getByRole('button', { name: /^Record a reading/ })).toBeVisible();
    await expect(page.locator('[data-today-alerts]')).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await capture('presentation');
  }
  writeFileSync('test-results/profile/index.html', `<!doctype html><title>Profile screens</title><style>body{font:16px sans-serif}section{display:flex;gap:16px;flex-wrap:wrap}img{width:300px;border:1px solid #ddd}figure{margin:12px}figcaption{max-width:300px}</style><h1>Profile, contacts and emergency card</h1>${sizes.map(([w,h]) => `<h2>${w} × ${h}</h2><section>${['about-unknown','emergency-unknown','about','about-edit','contacts','contact-edit','emergency','today-alerts', ...(w >= 768 ? ['presentation'] : [])].map(name => `<figure><a href="${w}x${h}/${name}.png"><img src="${w}x${h}/${name}.png"></a><figcaption>${name}</figcaption></figure>`).join('')}</section>`).join('')}`);
});
