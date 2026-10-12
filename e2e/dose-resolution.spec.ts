import { test, expect, family, checked, signIn, today, tomorrow, more } from './helpers';

test('n. Linked late/missed doses, explicit extras, skips and undo', async ({ page, sessions }) => {
  void sessions;
  const f = await family();
  const meds: Record<string, string> = {};
  for (const [name, schedule_time] of [['Late tablet', '11:30 AM'], ['Missed tablet', '8:00 AM'], ['Extra tablet', '12:00 PM / 1:00 PM'], ['Skip tablet', '11:45 AM']]) {
    const row = await checked(f.admin.client.from('medicines').insert({ household_id: f.id, name, schedule_time, potency: '5 mg', amount: '1 tablet' }).select().single());
    meds[name] = row.id;
  }
  await page.clock.setFixedTime(new Date(`${today()}T12:00:00-04:00`));
  await signIn(page, f.admin);
  const upcoming = page.locator('section').filter({ hasText: 'Coming up · next 12 hours' });
  const given = page.locator('section').filter({ hasText: 'Given · last 12 hours' });
  const capture = async (name: string) => {
    for (const [width, height] of [[393, 852], [800, 1280]]) {
      await page.setViewportSize({ width, height });
      for (const scale of [100, 130]) {
        await page.evaluate(scale => document.documentElement.style.fontSize = `${16 * scale / 100}px`, scale);
        await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
        const dialog = page.getByRole('dialog');
        if (await dialog.count()) {
          await expect(async () => {
            const rect = await dialog.boundingBox();
            expect(rect!.y).toBeGreaterThanOrEqual(0);
            expect(rect!.y + rect!.height).toBeLessThanOrEqual(height + 1);
          }).toPass();
        }
        await page.screenshot({ path: `test-results/dose-resolution/${width}x${height}/${name}${scale === 130 ? '-text130' : ''}.png`, fullPage: !(await dialog.count()) });
      }
    }
    await page.evaluate(() => document.documentElement.style.fontSize = '');
  };
  await expect(upcoming.getByText('MISSED', { exact: true })).toBeVisible();
  await expect(upcoming.getByRole('button', { name: /MISSED/ })).toHaveCSS('animation-name', 'none');
  await capture('missed-row');
  await upcoming.getByRole('button', { name: /^Late tablet/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('5 mg · 1 tablet', { exact: true })).toBeVisible();
  await expect(sheet.getByText('This dose was due at 11:30 AM. When was it given?')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Change', exact: true })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await capture('late-question');
  await sheet.getByRole('button', { name: 'At another time', exact: true }).click();
  await sheet.getByLabel('Date', { exact: true }).fill('');
  await expect(sheet.getByLabel('Date', { exact: true })).toHaveValue('');
  await expect(sheet.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await sheet.getByLabel('Date', { exact: true }).fill(tomorrow());
  await expect(sheet.getByRole('alert')).toHaveText('Choose a time that has already passed.');
  await expect(sheet.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await sheet.getByRole('button', { name: 'At 11:30 AM, on time', exact: true }).click();
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  const late = await checked(f.admin.client.from('medicine_logs').select('*').eq('medicine_id', meds['Late tablet']).single());
  expect([late.hour, late.minute, late.for_date, late.for_minute]).toEqual([11, 30, today(), 690]);
  await expect(upcoming.getByText('Late tablet', { exact: true })).toHaveCount(0);
  await upcoming.getByRole('button', { name: /^Missed tablet/ }).click();
  await sheet.getByRole('button', { name: 'Just now', exact: true }).click();
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(upcoming.getByText('Missed tablet', { exact: true })).toHaveCount(0);
  await given.getByRole('button', { name: /12:00 PM.*1 given/ }).click();
  await expect(given.getByText(/due 8:00 AM/)).toBeVisible();
  await page.getByRole('button', { name: /^Record a medicine/ }).click();
  await page.locator('.collapsible-content[data-state="open"]').getByRole('button', { name: /^Extra tablet/ }).click();
  await expect(sheet.getByText('Which dose is this?', { exact: true })).toBeVisible();
  await capture('which-dose');
  await sheet.getByRole('button', { name: 'An extra dose, not on the schedule', exact: true }).click();
  await checked(f.member.client.from('medicines').insert({ household_id: f.id, name: 'Refresh tablet', frequency: 'as needed' }));
  await expect(page.getByText(/^All 5 medicines/)).toHaveCount(1);
  await expect(sheet.getByRole('button', { name: 'An extra dose, not on the schedule', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.getByText(/When was it given/)).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  const extra = await checked(f.admin.client.from('medicine_logs').select('*').eq('medicine_id', meds['Extra tablet']).single());
  expect(extra.is_extra).toBe(true); expect(extra.for_date).toBeNull();
  await expect(upcoming.getByRole('button', { name: /^Extra tablet/ }).first()).toBeVisible();
  await upcoming.getByRole('button', { name: /^Skip tablet/ }).click();
  await sheet.getByRole('button', { name: 'Skip this dose', exact: true }).click();
  await expect(sheet.getByRole('heading', { name: 'Why is it skipped?' })).toBeVisible();
  await expect(sheet.getByText('Skip tablet', { exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: "Doctor's advice", exact: true }).click();
  await capture('skip-sheet');
  await sheet.getByRole('button', { name: 'Save skip', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(upcoming.getByText('Skip tablet', { exact: true })).toHaveCount(0);
  await given.getByRole('button', { name: /11:45 AM.*skipped/ }).click();
  await expect(given.getByText(/Skipped: Skip tablet.*doctor's advice/)).toBeVisible();
  await expect(given.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await capture('skipped-undo');
  expect(await checked(f.admin.client.from('medicine_logs').select('*').eq('medicine_id', meds['Skip tablet']))).toHaveLength(0);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('Skipped: Skip tablet (11:45 AM)', { exact: true })).toBeVisible();
  await expect(page.getByText('meds given', { exact: true }).locator('..')).toContainText('3');
  await more(page, 'Reports & downloads');
  await expect(page.getByText('Total doses: 3', { exact: true })).toBeVisible();
  await expect(page.getByText(/1× Late tablet/).first()).toBeVisible();
  await expect(page.getByText(/1× Skip tablet/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await given.getByRole('button', { name: /11:45 AM.*skipped/ }).click();
  await given.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(upcoming.getByRole('button', { name: /^Skip tablet/ })).toBeVisible();
});

test('p. A failed skip lookup never becomes a false MISSED dose or an unlinked save', async ({ page, sessions }) => {
  void sessions;
  const f = await family();
  await checked(f.admin.client.from('medicines').insert({ household_id: f.id, name: 'Connection tablet', schedule_time: '8:00 AM' }));
  await page.clock.setFixedTime(new Date(`${today()}T12:00:00-04:00`));
  await signIn(page, f.admin);
  const upcoming = page.locator('section').filter({ hasText: 'Coming up · next 12 hours' });
  await expect(upcoming.getByText('MISSED', { exact: true })).toBeVisible();
  await page.route('**/rest/v1/dose_skips*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic connection failure' }) }));
  await page.reload();
  await expect(upcoming.getByRole('alert')).toHaveText("Couldn't load doses. Check the connection.");
  await expect(upcoming.getByText('MISSED', { exact: true })).toHaveCount(0);
  await expect(upcoming.getByText('Nothing scheduled in the next 12 hours.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Record a medicine/ }).click();
  await page.locator('.collapsible-content[data-state="open"]').getByRole('button', { name: /^Connection tablet/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await checked(f.admin.client.from('medicine_logs').select('*').eq('household_id', f.id))).toHaveLength(0);
  await page.unroute('**/rest/v1/dose_skips*');
  await page.reload();
  await expect(upcoming.getByText('MISSED', { exact: true })).toBeVisible();
});
