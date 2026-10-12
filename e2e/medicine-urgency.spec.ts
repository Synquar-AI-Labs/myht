import { test, expect, family, checked, signIn, today, tomorrow, more, choose } from './helpers';

test('m. Urgency stays loud on phone/tablet; interval start dates control scheduled days', async ({ page, sessions }) => {
  void sessions;
  const f = await family();
  for (const [name, time, frequency, start_date] of [
    ['Soon medicine', '12:05 PM', 'daily', null],
    ['Due medicine', '12:00 PM', 'daily', null],
    ['Late medicine', '11:30 AM', 'daily', null],
    ['Interval today', '12:30 PM', 'every 2 days', today()],
    ['Interval tomorrow', '12:30 PM', 'every 2 days', tomorrow()],
    ['Legacy interval', '12:30 PM', 'every 2 days', null],
  ]) await checked(f.admin.client.from('medicines').insert({ household_id: f.id, name, schedule_time: time, frequency, start_date }));
  await page.clock.setFixedTime(new Date(`${today()}T12:00:00-04:00`));
  await signIn(page, f.admin);
  for (const [width, height] of [[393, 852], [800, 1280]]) {
    await page.setViewportSize({ width, height });
    const upcoming = page.locator('section').filter({ hasText: 'Coming up · next 12 hours' });
    for (const [badge, motion] of [['SOON', 'medicine-pulse-slow'], ['DUE NOW', 'medicine-pulse-fast'], ['LATE', 'medicine-pulse-fast']]) {
      const row = upcoming.getByRole('button', { name: new RegExp(badge) });
      await expect(row).toHaveAttribute('aria-expanded', 'true');
      await expect(row).toHaveClass(new RegExp(motion));
      await expect(row).toHaveCSS('animation-name', 'medicineUrgencyPulse');
      await expect(row).toHaveCSS('animation-duration', badge === 'SOON' ? '2.4s' : '1.2s');
      await row.click();
      await expect(row).toHaveAttribute('aria-expanded', 'false');
      await expect(row).toHaveClass(new RegExp(motion));
      await expect(row).toHaveCSS('animation-name', 'medicineUrgencyPulse');
      await expect(row.getByText(badge, { exact: true })).toBeVisible();
      await row.click();
    }
    const interval = upcoming.getByRole('button', { name: /12:30 PM/ });
    await interval.click();
    await expect(upcoming.getByRole('button', { name: /^Interval today/ })).toBeVisible();
    await expect(upcoming.getByText('Interval tomorrow', { exact: true })).toHaveCount(0);
    await expect(upcoming.getByText('Legacy interval', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /^Record a medicine/ }).click();
    const medicines = page.locator('.collapsible-content[data-state="open"]');
    for (const badge of ['SOON', 'DUE NOW', 'LATE']) await expect(medicines.getByText(badge, { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/urgency/${width}x${height}/today.png`, fullPage: true, animations: 'disabled' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(upcoming.getByRole('button', { name: /SOON/ })).toHaveCSS('animation-name', 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: /^Record a medicine/ }).click();
    await interval.click();
  }
  await more(page, 'Medicine cabinet');
  await expect(page.getByText('Pick a start day to see this under Coming up.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByPlaceholder('Medicine name').fill('New interval medicine');
  await choose(page, form.getByRole('combobox', { name: 'Which days is it given?' }), 'Every 2 days');
  await expect(form.getByLabel('Which day does it start?')).toHaveValue(today());
  await form.getByRole('button', { name: 'Add another time' }).click();
  await choose(page, form.getByRole('combobox', { name: 'Medicine time 1' }), '12:30 PM');
  const startLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Toronto' }).format(new Date(`${today()}T12:00:00-04:00`));
  await expect(form.getByRole('status')).toContainText(`starting ${startLabel}`);
  await form.getByRole('button', { name: 'Add Medicine', exact: true }).click();
  await expect(form).toHaveCount(0);
  const saved = await checked(f.admin.client.from('medicines').select('start_date,frequency').eq('name', 'New interval medicine').single());
  expect(saved.start_date).toBe(today()); expect(saved.frequency).toBe('every 2 days');
});
