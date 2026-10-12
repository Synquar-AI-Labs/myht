import { test, expect, family, checked, signIn, today } from './helpers';
import { closeDialog } from './dismiss';
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
  for (const [width, height] of [[320, 568], [360, 800], [393, 852], [800, 1280], [1280, 800]]) {
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
          const sameLine = (header: Element) => getComputedStyle(header).gridTemplateAreas.includes('time relative status count chevron');
          const single = headers.map(sameLine);
          const relativeXs = headers.map(header => rect(header.querySelector('.dose-relative')!).x);
          const countRights = headers.map(header => rect(header.querySelector('.dose-count')!).right);
          const errors: string[] = [];
          if (card.scrollWidth > card.clientWidth + 1) errors.push('card overflow');
          headers.forEach((header, i) => {
            const time = rect(header.querySelector('.dose-time')!);
            const relative = rect(header.querySelector('.dose-relative')!);
            const controls = rect(header.querySelector('.dose-chevron')!);
            const count = rect(header.querySelector('.dose-count')!);
            if (header.classList.contains('dose-tinted')) {
              if (!near(time.x - rect(header).x, 6) || !near(rect(header).right - controls.right, 6)) errors.push('tint padding');
              if (getComputedStyle(card).overflowX !== 'hidden') errors.push('pulse not contained');
              const chip = header.querySelector('.dose-count > span');
              if (chip && getComputedStyle(chip).backgroundColor !== 'rgb(255, 255, 255)') errors.push('tinted chip not white');
            }
            if (single[i] && !near(relative.y + relative.height / 2, time.y + time.height / 2)) errors.push('not physically one line');
            if (!single[i] && relative.y < time.bottom) errors.push('not physically two lines');
            if (!near(relative.x, relativeXs[0])) errors.push('relative column');
            if (!near(count.right, countRights[0])) errors.push('count column');
            if (!single[i] && !near(relative.x, time.x)) errors.push('two-line label edge');
            header.parentElement!.querySelectorAll('.dose-name,.dose-detail,.dose-skip').forEach(el => { if (!near(rect(el).x, time.x + 18)) errors.push('18px indent'); });
            header.parentElement!.querySelectorAll('.dose-name').forEach(el => { if (getComputedStyle(el).fontWeight !== '600') errors.push('medicine name not semibold'); });
            header.parentElement!.querySelectorAll('.dose-record,.dose-undo').forEach(el => { if (!near(rect(el).right, controls.right)) errors.push('right edge'); });
            const rows = header.parentElement!.querySelector('.dose-group-rows');
            if (rows) {
              const line = getComputedStyle(rows, '::before');
              if (parseFloat(line.left) !== 6 || parseFloat(line.width) !== 2 || line.backgroundColor !== 'rgb(233, 226, 214)') errors.push('indent line');
            }
            header.parentElement!.querySelectorAll<HTMLElement>('.dose-name,.dose-detail,.dose-skip,.dose-record,.dose-undo').forEach(el => {
              if (el.scrollWidth > el.clientWidth + 1) errors.push('clipped entry');
            });
            const undo = header.parentElement!.querySelector('.dose-undo');
            if (undo) { const range = document.createRange(); range.selectNodeContents(undo); if (!near(range.getBoundingClientRect().right, controls.right)) errors.push('Undo text edge'); }
            header.querySelectorAll<HTMLElement>('span').forEach(el => { if (el.scrollWidth > el.clientWidth + 1) errors.push('clipped header: ' + el.className + ' ' + el.scrollWidth + '/' + el.clientWidth); });
            if (header.scrollWidth > header.clientWidth + 1 || rect(header).right > rect(card).right) errors.push('overflow');
            if (rect(header).height < 44) errors.push('touch height');
          });
          const isUpcoming = card.closest('section')!.textContent!.includes('Coming up');
          const probe = document.createElement('div');
          probe.className = 'dose-card';
          probe.style.cssText = 'position:absolute;visibility:hidden;width:18.25em;';
          const fixture = (headers.find(h => h.textContent?.includes('MISSED')) ?? headers[0]).cloneNode(true) as HTMLElement;
          fixture.querySelector('.dose-time')!.textContent = '12:45 PM';
          fixture.querySelector('.dose-count > span')!.textContent = '99';
          probe.append(fixture); document.body.append(probe);
          const textWidth = (selector: string) => { const range = document.createRange(); range.selectNodeContents(fixture.querySelector(selector)!); return range.getBoundingClientRect().width; };
          const badge = fixture.querySelector('.dose-status > span')?.cloneNode(true) as HTMLElement;
          const fixtures = (isUpcoming ? [['59 min ago', 'LATE'], ['11 h ago', 'MISSED'], ['', 'DUE NOW'], ['in 11 h 59 min', '']] : [['59 min ago', '12 skipped']]).map(([label, status]) => {
            fixture.querySelector('.dose-relative')!.textContent = label;
            if (isUpcoming) {
              fixture.querySelector('.dose-status')!.replaceChildren();
              fixture.classList.toggle('dose-tinted', !!status);
              if (status) { const copy = badge.cloneNode(true) as HTMLElement; copy.textContent = status; fixture.querySelector('.dose-status')!.append(copy); }
            }
            else fixture.querySelector('.dose-status')!.innerHTML = '<span class="dose-skipped-count whitespace-nowrap text-sm text-[#8b8175]">12 skipped</span>';
            const statusWidth = rect(fixture.querySelector('.dose-status')!).width;
            const required = rect(fixture.querySelector('.dose-time')!).width + textWidth('.dose-relative') + statusWidth + rect(fixture.querySelector('.dose-count')!).width + rect(fixture.querySelector('.dose-chevron')!).width + 24;
            if (fixture.scrollWidth > fixture.clientWidth + 1 || fixture.querySelector<HTMLElement>('.dose-relative')!.scrollWidth > fixture.querySelector<HTMLElement>('.dose-relative')!.clientWidth + 1) errors.push('longest fixture overflow');
            return { label, status, required, statusWidth, single: sameLine(fixture) };
          });
          const threshold = rect(probe).width;
          probe.remove();
          const style = getComputedStyle(card);
          return { card: isUpcoming ? 'Coming up' : 'Given', width: card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), single, errors, threshold, fixtures, countRights };
        });
      });
      widths.push({ viewport: width, scale, cards: result });
      if (width < 768) {
        const clock = page.locator('[data-today-clock]');
        await expect(clock).toHaveCSS('white-space', 'nowrap');
        expect(await clock.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      }
      for (const card of result) {
        expect(card.errors, JSON.stringify({ width, scale, card })).toEqual([]);
        expect(new Set(card.single).size).toBe(1);
        for (const fixture of card.fixtures) { expect(fixture.single).toBe(true); expect(fixture.required).toBeLessThanOrEqual(card.threshold); }
        expect(card.single.every(Boolean)).toBe(card.width >= card.threshold);
        if (width === 320) expect(card.single.every(value => !value)).toBe(true);
        if (width >= 360 && scale === 100) expect(card.single.every(Boolean)).toBe(true);
      }
      const dir = `test-results/today-layout/${width}x${height}`;
      const suffix = scale === 130 ? '-text130' : '';
      await page.screenshot({ path: `${dir}/urgency${suffix}.png`, fullPage: true, animations: 'disabled' });
      await given.screenshot({ path: `${dir}/given-skipped${suffix}.png`, animations: 'disabled' });
      const missed = upcoming.getByRole('button', { name: /MISSED/ });
      await expect(missed).toHaveCSS('background-color', 'rgb(243, 240, 236)');
      await expect(missed).toHaveCSS('animation-name', 'none');
      // Close every group, then open only a calm scheduled group.
      for (const section of [upcoming, given]) for (const header of await section.locator('.dose-time-header').all()) if (await header.getAttribute('aria-expanded') === 'true') await header.click();
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
      await closeDialog(page, sheet);
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
        await closeDialog(page, sheet);
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
        await closeDialog(page, sheet);
        await expect(sheet).toHaveCount(0);
      }
    }
  }
  await mkdir('test-results/today-layout', { recursive: true });
  await writeFile('test-results/today-layout/measurements.json', JSON.stringify(widths, null, 2));
});
