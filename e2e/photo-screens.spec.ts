import { test, expect, family, checked, signIn, more } from './helpers';
import { photoResult, syntheticPhoto, choosePhotos } from './prescription-fixtures';

for (const [width, height] of [[320, 568], [393, 852], [800, 1280], [1280, 800]]) test(`${width}x${height} prescription photo screen audit`, async ({ page, sessions }) => {
  void sessions;
  await page.setViewportSize({ width, height });
  const f = await family();
  await checked(f.admin.client.from('medicines').insert({ household_id: f.id, name: 'Existing synthetic tablet', amount: '1 tablet', frequency: 'as needed' }));
  await page.route('**/functions/v1/read-prescription', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(photoResult) }));
  await signIn(page, f.admin);await more(page, 'Medicine cabinet');
  await expect(page.getByText('Existing synthetic tablet', { exact: true })).toBeVisible();
  const capture = async (screen: string, scale: number, fullPage = true) => {
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await expect(async () => {
      const problems = await page.evaluate(() => {
        const errors: string[] = [];
        if (document.documentElement.scrollWidth > innerWidth + 1) errors.push('page overflow');
        const visible = (el: Element) => el.getClientRects().length && !el.closest('[aria-hidden="true"]');
        for (const el of document.querySelectorAll<HTMLElement>('button,a[href],input:not([type=file]),[role=combobox]')) {
          if (!visible(el)) continue;
          const r = el.getBoundingClientRect();
          // Match the existing screen audit: the checkbox's associated label
          // is a real native pointer target, not just its 16px glyph.
          const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
          const target = label?.getBoundingClientRect();
          if ((r.width < 43.9 || r.height < 43.9) && !(target && target.width >= 44 && target.height >= 44)) errors.push(`small target ${el.textContent || el.getAttribute('aria-label')}: ${r.width}x${r.height}`);
          if (r.left < -1 || r.right > innerWidth + 1) errors.push(`control overflow ${el.textContent || el.getAttribute('aria-label')}: ${r.left}..${r.right}`);
        }
        for (const card of document.querySelectorAll('.prescription-card')) {
          const title = card.querySelector('h3')!.getBoundingClientRect();
          for (const copy of card.querySelectorAll('p,.prescription-card-actions')) {
            const r = copy.getBoundingClientRect();
            if (Math.abs(r.left - title.left) > 1 || Math.abs(r.right - title.right) > 1) errors.push('card content edges');
          }
          const actions = card.querySelector('.prescription-card-actions');
          if (actions) {
            const buttons = actions.querySelectorAll('button');
            if (Math.abs(buttons[0].getBoundingClientRect().left - title.left) > 1 || Math.abs(buttons[buttons.length - 1].getBoundingClientRect().right - title.right) > 1) errors.push('card action edges');
          }
        }
        return errors;
      });
      expect(problems).toEqual([]);
    }).toPass({ timeout: 15_000 });
    await page.screenshot({ path: `test-results/prescription-photos/${width}x${height}/${screen}${scale === 130 ? '-text130' : ''}.png`, fullPage, animations: 'disabled' });
  };
  const photo = await syntheticPhoto(page, 'screen', '#f2ede5');
  await page.getByRole('button', { name: 'Add from a photo', exact: true }).click();
  await choosePhotos(page, Array.from({ length: 4 }, (_, i) => ({ ...photo, name: `synthetic-${i}.png` })));
  await page.getByRole('button', { name: 'Read 4 photos', exact: true }).click();
  const first = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Synthetic photo medicine', exact: true }) }).first();
  await first.getByRole('button', { name: 'Check and add', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByRole('button', { name: 'Fill times', exact: true }).click();
  await form.getByRole('button', { name: 'Add Medicine', exact: true }).click();
  await expect(form).toHaveCount(0);await expect(first.getByText('Added', { exact: true })).toBeVisible();
  expect((await checked(f.admin.client.from('medicines').select('source').eq('household_id', f.id).eq('name', 'Synthetic photo medicine').single())).source).toBe('prescription_photo');
  for (const scale of [100, 130]) {
    await page.evaluate(scale => document.documentElement.style.fontSize = `${16 * scale / 100}px`, scale);
    await capture('review-list', scale);
    await page.locator('article').filter({ hasText: 'Synthetic interval medicine' }).getByRole('button', { name: 'Check and add', exact: true }).click();
    await expect(form.getByPlaceholder('Medicine name')).toHaveValue('Synthetic interval medicine');
    await expect(form.getByRole('button', { name: 'Add Medicine', exact: true })).toBeDisabled();
    await form.evaluate(el => { el.scrollTop = 0; });await capture('filled-form-top', scale, false);
    await form.getByRole('button', { name: 'Add Medicine', exact: true }).scrollIntoViewIfNeeded();
    await expect(form.getByRole('button', { name: 'Add Medicine', exact: true })).toBeInViewport({ ratio: 1 });
    await capture('filled-form-bottom', scale, false);
    await page.keyboard.press('Escape');await expect(form).toHaveCount(0);
  }
  await page.evaluate(() => document.documentElement.style.fontSize = '');await page.getByRole('button', { name: 'Done', exact: true }).click();
  for (const scale of [100, 130]) {
    await page.evaluate(scale => document.documentElement.style.fontSize = `${16 * scale / 100}px`, scale);
    await capture('cabinet-heading', scale);await page.getByRole('button', { name: 'Add from a photo', exact: true }).click();
    await capture('photo-empty', scale);
    await page.getByRole('button', { name: 'Choose photos', exact: true }).evaluate(el => el.scrollIntoView({ block: 'center' }));
    await capture('photo-empty-controls', scale, false);
    await expect(page.getByLabel('Take prescription photo')).toHaveAttribute('capture', 'environment');
    await expect(page.getByLabel('Take prescription photo')).not.toHaveAttribute('multiple');
    await expect(page.getByLabel('Choose prescription photos')).toHaveAttribute('multiple');
    await expect(page.getByLabel('Choose prescription photos')).not.toHaveAttribute('capture');
    await choosePhotos(page, [{ ...photo, name: 'synthetic-0.png' }, { ...photo, name: 'synthetic-1.png' }]);
    await expect(page.getByRole('button', { name: 'Take a photo', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose photos', exact: true })).toBeVisible();
    await capture('photo-two', scale);
    await page.getByRole('button', { name: 'Read 2 photos', exact: true }).evaluate(el => el.scrollIntoView({ block: 'center' }));
    await capture('photo-two-controls', scale, false);
    await page.getByRole('button', { name: 'View photo 1', exact: true }).click();
    const viewer = page.getByRole('dialog');
    await expect(viewer.getByRole('button', { name: 'Make bigger', exact: true })).toBeVisible();
    const fitted = await viewer.evaluate(el => {
      const box = el.querySelector('[data-photo-scroll]')!;
      return { width: el.getBoundingClientRect().width, viewport: innerWidth, scroll: box.scrollWidth, visible: box.clientWidth };
    });
    expect(fitted.width).toBeGreaterThan(fitted.viewport * 0.9);expect(fitted.scroll).toBe(fitted.visible);
    await capture('viewer-fit', scale, false);
    await viewer.getByRole('button', { name: 'Make bigger', exact: true }).click();
    const dimensions = await viewer.locator('img').evaluate(image => ({ natural: image.naturalWidth, width: image.getBoundingClientRect().width, scroll: image.parentElement!.scrollWidth, visible: image.parentElement!.clientWidth }));
    expect(dimensions.width).toBe(dimensions.natural);expect(dimensions.scroll).toBeGreaterThan(dimensions.visible);
    await viewer.locator('[data-photo-scroll]').evaluate(el => { el.scrollLeft = 100; el.scrollTop = 100; });
    expect(await viewer.locator('[data-photo-scroll]').evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    expect(await viewer.locator('[data-photo-scroll]').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await viewer.locator('[data-photo-scroll]').evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
    expect(await viewer.locator('[data-photo-scroll]').evaluate(el => [el.scrollLeft, el.scrollTop])).toEqual([0, 0]);
    await capture('viewer-bigger', scale, false);
    await viewer.getByRole('button', { name: 'Fit to screen', exact: true }).click();
    await page.keyboard.press('Escape');await expect(viewer).toHaveCount(0);
    await choosePhotos(page, [{ ...photo, name: 'synthetic-2.png' }, { ...photo, name: 'synthetic-3.png' }]);
    await expect(page.getByRole('button', { name: 'Read 4 photos', exact: true })).toBeVisible();await capture('photo-four', scale);
    await page.getByRole('button', { name: 'Back to medicines', exact: true }).click();
  }
});
