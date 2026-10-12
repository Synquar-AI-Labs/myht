import { test, expect, family, checked, signIn, today } from './helpers';
import { writeFile, mkdir } from 'node:fs/promises';

test('r. Card-width headers share edges, fit longest labels and show corrected dose states', async ({ page, sessions }) => {
  void sessions;
  const f = await family();
  const date = today();
  const ids: Record<string, string> = {};
  for (const [name, schedule_time] of [
    ['Calm tablet', '1:00 PM / 1:30 PM'], ['Soon tablet', '12:05 PM'],
    ['Due tablet', '12:00 PM'], ['Late tablet', '11:30 AM'], ['Missed tablet', '8:00 AM'],
    ['Given tablet', '10:00 AM'], ['Skipped tablet', '10:00 AM'],
  ]) ids[name] = (await checked(f.admin.client.from('medicines').insert({ household_id: f.id, name, schedule_time, amount: '1 tablet', potency: '5 mg' }).select('id').single())).id;
  const person = f.people.find(p => p.user_id === f.admin.id)!;
  await checked(f.admin.client.from('medicine_logs').insert({ household_id: f.id, medicine_id: ids['Given tablet'], date, hour: 10, minute: 0, am_pm: 'AM', for_date: date, for_minute: 600, caregiver_id: person.caregiver_id, recorded_by: person.display_name }));
  await checked(f.admin.client.from('dose_skips').insert({ household_id: f.id, medicine_id: ids['Skipped tablet'], for_date: date, for_minute: 600, reason: 'Not needed', caregiver_id: person.caregiver_id, recorded_by: person.display_name }));
  await page.clock.setFixedTime(new Date(`${date}T12:00:00-04:00`));
  await signIn(page, f.admin);
  const upcoming = page.locator('section').filter({ hasText: 'Coming up · next 12 hours' });
  const given = page.locator('section').filter({ hasText: 'Given · last 12 hours' });
  const widths: unknown[] = [];
  for (const [width, height] of [[393, 852], [800, 1280], [1024, 768], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    for (const scale of [100, 130]) {
      await page.evaluate(scale => document.documentElement.style.fontSize = `${16 * scale / 100}px`, scale);
      await page.evaluate(() => document.fonts.ready);
      await expect(upcoming.locator('.dose-time-header'), 'Coming up must finish loading its six expected time headers').toHaveCount(6);
      await expect(given.locator('.dose-time-header'), 'Given must finish loading its expected time header').toHaveCount(1);
      for (const section of [upcoming, given]) {
        for (const header of await section.locator('.dose-time-header').all()) {
          if (await header.getAttribute('aria-expanded') === 'false') await header.click();
        }
      }
      await page.locator('.dose-controls svg').evaluateAll(async nodes => {
        await Promise.all(nodes.flatMap(node => node.getAnimations().map(animation => animation.finished.catch(() => undefined))));
      });
      const result = await page.evaluate(() => {
        const rect = (el: Element) => el.getBoundingClientRect();
        const near = (a: number, b: number) => Math.abs(a - b) <= 1;
        return [...document.querySelectorAll<HTMLElement>('.dose-card')].map(card => {
          const headers = [...card.querySelectorAll<HTMLElement>('.dose-time-header')];
          if (!headers.length) throw new Error(`Cannot measure dose card with no headers: ${card.closest('section')!.textContent}`);
          const sameLine = (header: Element) => {
            const a = rect(header.querySelector('.dose-time')!), b = rect(header.querySelector('.dose-relative')!);
            return near(a.y + a.height / 2, b.y + b.height / 2);
          };
          const single = headers.map(sameLine);
          const relativeXs = headers.map(header => rect(header.querySelector('.dose-relative')!).x);
          const countRights = headers.map(header => rect(header.querySelector('.dose-count')!).right);
          const errors: string[] = [];
          if (card.scrollWidth > card.clientWidth + 1) errors.push('card overflow');
          headers.forEach((header, i) => {
            const time = rect(header.querySelector('.dose-time')!);
            const relative = rect(header.querySelector('.dose-relative')!);
            const controls = rect(header.querySelector('.dose-controls svg')!);
            const count = rect(header.querySelector('.dose-count')!);
            if (!near(relative.x, relativeXs[0])) errors.push('relative column');
            if (single[i] && !near(count.right, countRights[0])) errors.push('count column');
            if (!single[i] && (!near(relative.x, time.x) || !near(count.right, controls.right))) errors.push('two-line edges');
            header.parentElement!.querySelectorAll('.dose-name,.dose-detail,.dose-skip').forEach(el => { if (!near(rect(el).x, time.x)) errors.push('left edge'); });
            header.parentElement!.querySelectorAll('.dose-record,.dose-undo').forEach(el => { if (!near(rect(el).right, controls.right)) errors.push('right edge'); });
            header.parentElement!.querySelectorAll<HTMLElement>('.dose-name,.dose-detail,.dose-skip,.dose-record,.dose-undo').forEach(el => {
              if (el.scrollWidth > el.clientWidth + 1) errors.push('clipped entry');
            });
            const undo = header.parentElement!.querySelector('.dose-undo');
            if (undo) { const range = document.createRange(); range.selectNodeContents(undo); if (!near(range.getBoundingClientRect().right, controls.right)) errors.push('Undo text edge'); }
            header.querySelectorAll<HTMLElement>('span').forEach(el => { if (el.scrollWidth > el.clientWidth + 1) errors.push(`clipped header: ${el.className} ${el.textContent} (${el.scrollWidth}/${el.clientWidth})`); });
            if (header.scrollWidth > header.clientWidth + 1 || rect(header).right > rect(card).right) errors.push('overflow');
            if (rect(header).height < 44) errors.push('touch height');
          });
          // Use real rendered header styles at the exact 30em threshold,
          // including the widest specified strings and badge/count content.
          const probe = document.createElement('div');
          probe.className = 'dose-card';
          probe.style.cssText = 'position:absolute;visibility:hidden;width:30em;';
          const fixture = headers.find(h => h.textContent?.includes('MISSED'))?.cloneNode(true) as HTMLElement ?? headers[0].cloneNode(true) as HTMLElement;
          fixture.querySelector('.dose-time')!.textContent = '12:45 PM';
          fixture.querySelector('.dose-relative')!.textContent = card.closest('section')!.textContent!.includes('Coming up') ? '11 hours 59 minutes late' : '11 hours 59 minutes ago';
          fixture.querySelector('.dose-count')!.textContent = card.closest('section')!.textContent!.includes('Coming up') ? '99 medicines' : '12 given · 12 skipped';
          probe.append(fixture); document.body.append(probe);
          const textWidth = (selector: string) => { const range = document.createRange(); range.selectNodeContents(fixture.querySelector(selector)!); return range.getBoundingClientRect().width; };
          const fixtureStyle = getComputedStyle(fixture);
          const isUpcoming = fixture.classList.contains('dose-upcoming-header');
          const statusWidth = rect(fixture.querySelector('.dose-status')!).width;
          const required = rect(fixture.querySelector('.dose-time')!).width + textWidth('.dose-relative') + textWidth('.dose-count') + statusWidth + rect(fixture.querySelector('.dose-chevron')!).width + (isUpcoming ? 4 : 3) * 8 + parseFloat(fixtureStyle.paddingLeft) + parseFloat(fixtureStyle.paddingRight);
          const widestBadge = Math.max(0, ...headers.flatMap(header => [...header.querySelectorAll('.dose-status > span')].map(badge => rect(badge).width)));
          if (isUpcoming && statusWidth < widestBadge) errors.push('status column narrower than badge');
          const threshold = rect(probe).width;
          if (fixture.scrollWidth > fixture.clientWidth + 1 || fixture.querySelector<HTMLElement>('.dose-relative')!.scrollWidth > fixture.querySelector<HTMLElement>('.dose-relative')!.clientWidth + 1) errors.push('longest fixture overflow');
          const fixtureSingle = sameLine(fixture);
          probe.remove();
          const style = getComputedStyle(card);
          return { card: card.closest('section')!.textContent!.includes('Coming up') ? 'Coming up' : 'Given', width: card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), single, errors, threshold, required, statusWidth, widestBadge, countRights, fixtureSingle };
        });
      });
      widths.push({ viewport: width, scale, cards: result });
      for (const card of result) {
        expect(card.errors, JSON.stringify({ width, scale, card })).toEqual([]);
        expect(new Set(card.single).size).toBe(1);
        expect(card.fixtureSingle).toBe(true);
        expect(card.required).toBeLessThanOrEqual(card.threshold);
        if (width === 393 || width === 800) expect(card.single.every(value => !value)).toBe(true);
        if (width === 1280 && scale === 100) expect(card.single.every(Boolean)).toBe(true);
      }
      const dir = `test-results/today-layout/${width}x${height}`;
      const suffix = scale === 130 ? '-text130' : '';
      await page.screenshot({ path: `${dir}/urgency${suffix}.png`, fullPage: true, animations: 'disabled' });
      await given.screenshot({ path: `${dir}/given-skipped${suffix}.png`, animations: 'disabled' });
      const missed = upcoming.getByRole('button', { name: /MISSED/ });
      await expect(missed).toHaveCSS('background-color', 'rgb(243, 240, 236)');
      await expect(missed).toHaveCSS('animation-name', 'none');
      // Close every group, then open only a calm scheduled group.
      for (const header of await upcoming.locator('.dose-time-header').all()) if (await header.getAttribute('aria-expanded') === 'true') await header.click();
      await page.screenshot({ path: `${dir}/closed${suffix}.png`, fullPage: true, animations: 'disabled' });
      await upcoming.getByRole('button', { name: /^1:00 PM/ }).click();
      await page.screenshot({ path: `${dir}/calm-open${suffix}.png`, fullPage: true, animations: 'disabled' });
      await upcoming.getByRole('button', { name: /LATE/ }).click();
      await upcoming.getByRole('button', { name: /^Late tablet/ }).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByRole('button', { name: 'Change', exact: true })).toHaveCount(0);
      await sheet.getByRole('button', { name: 'At another time', exact: true }).click();
      await expect(sheet.getByRole('button', { name: 'At another time', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const answer = sheet.locator('button[aria-pressed="true"]');
      await expect(answer).toHaveCSS('border-top-width', '2px');
      await expect(answer).toHaveCSS('border-top-color', 'rgb(138, 98, 64)');
      await expect(answer).toHaveCSS('background-color', 'rgb(246, 238, 228)');
      await expect(answer.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await expect(sheet.getByLabel('Date', { exact: true })).toBeVisible();
      await expect(sheet.getByRole('combobox', { name: 'Dose time' })).toBeVisible();
      await expect(async () => { const r = await sheet.boundingBox(); expect(r!.y + r!.height).toBeLessThanOrEqual(height + 1); }).toPass();
      await page.screenshot({ path: `${dir}/late-another-time${suffix}.png`, animations: 'disabled' });
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      if (width === 393 || width === 1280) {
        const medicinePill = page.getByRole('button', { name: /^Record a medicine/ });
        if (await medicinePill.getAttribute('aria-expanded') === 'false') await medicinePill.click();
        await page.locator('.collapsible-content[data-state="open"]').getByRole('button', { name: /^Calm tablet/ }).click();
        await expect(sheet.getByText('Which dose is this?', { exact: true })).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'Change', exact: true })).toBeVisible();
        await sheet.getByRole('button', { name: /^The 1:00 PM dose/ }).click();
        await expect(answer).toHaveCSS('border-top-width', '2px');
        await expect(answer).toHaveCSS('border-top-color', 'rgb(138, 98, 64)');
        await expect(answer).toHaveCSS('background-color', 'rgb(246, 238, 228)');
        await expect(answer.locator('svg[aria-hidden="true"]')).toHaveCount(1);
        await page.screenshot({ path: `${dir}/which-dose-selected${suffix}.png`, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await expect(sheet).toHaveCount(0);
        if (await medicinePill.getAttribute('aria-expanded') === 'true') await medicinePill.click();
        await upcoming.getByRole('button', { name: /^Late tablet/ }).click();
        await sheet.getByRole('button', { name: 'Skip this dose', exact: true }).click();
        await sheet.getByRole('button', { name: 'Not needed', exact: true }).click();
        await expect(answer).toHaveCSS('border-top-width', '2px');
        await expect(answer).toHaveCSS('border-top-color', 'rgb(138, 98, 64)');
        await expect(answer).toHaveCSS('background-color', 'rgb(246, 238, 228)');
        await expect(answer.locator('svg[aria-hidden="true"]')).toHaveCount(1);
        await page.screenshot({ path: `${dir}/skip-reason-selected${suffix}.png`, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await expect(sheet).toHaveCount(0);
      }
    }
  }
  await mkdir('test-results/today-layout', { recursive: true });
  await writeFile('test-results/today-layout/measurements.json', JSON.stringify(widths, null, 2));
});
