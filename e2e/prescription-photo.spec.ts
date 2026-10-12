import { test, expect, family, checked, signIn, more, choose, today } from './helpers';
import { photoResult, photoMedicine, syntheticPhoto, choosePhotos, sourceMarker } from './prescription-fixtures';

test('s. Photos are shrunk, ordered, reviewed in the existing form and added without cached-list duplicates', async ({ page, sessions }) => {
  void sessions;
  const f = await family();
  await checked(f.admin.client.from('medicines').insert({ household_id: f.id, name: 'Existing synthetic tablet', amount: '1 tablet', frequency: 'as needed' }));
  await page.clock.setFixedTime(new Date(`${today()}T12:00:00-04:00`));
  await signIn(page, f.admin); await more(page, 'Medicine cabinet');
  await expect(page.getByText('Existing synthetic tablet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add from a photo', exact: true }).click();
  const colors = ['#ff0000', '#0000ff', '#00ff00', '#ffff00'];
  const files = [];
  for (const [index, color] of colors.entries()) files.push(await syntheticPhoto(page, 'photo-' + index, color));
  let sent = 0;
  await page.route('**/functions/v1/read-prescription', async route => {
    sent++;
    const request = route.request();
    const form = await new Response(request.postDataBuffer(), { headers: { 'content-type': request.headers()['content-type'] } }).formData();
    expect(form.get('household_id')).toBe(f.id);
    const photos = form.getAll('photo') as File[];
    expect(photos).toHaveLength(4);
    const samples = [];
    for (const photo of photos) {
      expect(photo.type).toBe('image/jpeg');expect(photo.size).toBeLessThanOrEqual(1.5 * 1024 * 1024);
      const bytes = [...new Uint8Array(await photo.arrayBuffer())];
      expect(bytes.slice(0, 3)).toEqual([255, 216, 255]);
      const info = await page.evaluate(async bytes => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }));
        const canvas = document.createElement('canvas');canvas.width = bitmap.width;canvas.height = bitmap.height;
        const context = canvas.getContext('2d')!;context.drawImage(bitmap, 0, 0);
        const info = { width: bitmap.width, height: bitmap.height, color: [...context.getImageData(0, 0, 1, 1).data] };bitmap.close();return info;
      }, bytes);
      expect([info.width, info.height]).toEqual([2048, 1536]);samples.push(info.color);
    }
    for (const [index, expected] of [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]].entries()) expected.forEach((value, channel) => expect(Math.abs(samples[index][channel] - value)).toBeLessThan(5));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(photoResult) });
  });
  await choosePhotos(page, [files[0]]);
  await choosePhotos(page, [files[1]]);
  await choosePhotos(page, [files[2]]);
  await expect(page.getByRole('button', { name: 'Read 3 photos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove photo 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Read 2 photos', exact: true })).toBeVisible();
  await choosePhotos(page, [files[1], files[3]]);
  await expect(page.getByRole('button', { name: 'Choose photos', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Take a photo', exact: true })).toHaveCount(0);
  expect(sent).toBe(0);
  await page.getByRole('button', { name: 'Read 4 photos', exact: true }).click();
  await expect(page.getByText('Read by a computer. Check every line against the photos before adding.', { exact: true })).toBeVisible();
  expect(sent).toBe(1);
  await expect(page.getByText('From photos 1 and 2', { exact: true }).first()).toBeVisible();
  const discard = page.locator('article').filter({ hasText: 'Discard synthetic tablet' });
  await discard.getByRole('button', { name: 'Not this one', exact: true }).click();
  await expect(discard).toHaveCount(0);
  const originals = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Synthetic photo medicine', exact: true }) });
  await originals.nth(0).getByRole('button', { name: 'Check and add', exact: true }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByPlaceholder('Medicine name')).toHaveValue('Synthetic photo medicine');
  await expect(form.getByPlaceholder('e.g. 500mg')).toHaveValue('5 mg');
  await expect(form.getByText('Potency', { exact: false }).first()).toContainText('Check this');
  await expect(form.getByRole('combobox', { name: /Medicine time/ })).toHaveCount(3);
  await expect(form.getByRole('button', { name: 'Add Medicine', exact: true })).toBeDisabled();
  await expect(form.getByRole('combobox', { name: 'Every how many hours' })).toHaveText('8 hours');
  await form.getByRole('button', { name: 'View photos', exact: true }).click();
  const viewer = page.getByRole('dialog');
  await expect(viewer.getByRole('heading', { name: 'Photo 1', exact: true })).toBeVisible();
  await viewer.getByRole('button', { name: 'Make bigger', exact: true }).click();
  const dimensions = await viewer.locator('img').evaluate(image => ({ actual: image.getBoundingClientRect().width, natural: image.naturalWidth, scroll: image.parentElement!.scrollWidth, viewport: image.parentElement!.clientWidth }));
  expect(dimensions.actual).toBe(dimensions.natural);expect(dimensions.scroll).toBeGreaterThan(dimensions.viewport);
  await viewer.locator('[data-photo-scroll]').evaluate(el => { el.scrollLeft = 100; el.scrollTop = 100; });
  expect(await viewer.locator('[data-photo-scroll]').evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  expect(await viewer.locator('[data-photo-scroll]').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await viewer.getByRole('button', { name: 'Fit to screen', exact: true }).click();
  await viewer.getByRole('button', { name: 'Next photo', exact: true }).click();
  await expect(viewer.getByRole('heading', { name: 'Photo 2', exact: true })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Next photo', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Photo 2', exact: true })).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'View photos', exact: true })).toBeVisible();
  await form.getByRole('button', { name: 'Fill times', exact: true }).click();
  await expect(form.getByText('Replace the times you picked?', { exact: true })).toHaveCount(0);
  let release!: () => void;
  const refresh = new Promise<void>(done => { release = done; });
  await page.route('**/rest/v1/medicines*', async route => { if (route.request().method() === 'GET') await refresh; await route.continue(); });
  try {
    await form.getByRole('button', { name: 'Add Medicine', exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(originals.nth(0).getByText('Added', { exact: true })).toBeVisible();
    await expect(originals.nth(1).getByText('Already in your medicines: Synthetic photo medicine', { exact: true })).toBeVisible();
    const saved = await checked(f.admin.client.from('medicines').select('*').eq('household_id', f.id).eq('name', 'Synthetic photo medicine').single());
    expect(saved.source).toBe('prescription_photo');expect(saved.schedule_time).toBe('12:00 AM / 8:00 AM / 4:00 PM');
    expect(saved.schedule_note).toBe('after meals, for 7 days');
    expect((await checked(f.admin.client.from('medicines').select('id').eq('household_id', f.id)))).toHaveLength(2);
  } finally { release(); await page.unroute('**/rest/v1/medicines*'); }
  const already = page.locator('article').filter({ hasText: 'Already recorded prescription line' });
  await already.getByRole('button', { name: 'Open it', exact: true }).click();
  await expect(form.getByRole('heading', { name: 'Edit Medicine', exact: true })).toBeVisible();
  await expect(form.getByPlaceholder('Medicine name')).toHaveValue('Existing synthetic tablet');
  await expect(form.getByPlaceholder('Medicine name')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(form).toHaveCount(0);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const stored = await page.evaluate(async () => {
    const values: unknown[] = Object.values(localStorage);
    for (const info of await indexedDB.databases()) {
      const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(info.name!);request.onsuccess = () => resolve(request.result);request.onerror = () => reject(request.error); });
      for (const name of database.objectStoreNames) values.push(await new Promise(resolve => { const request = database.transaction(name).objectStore(name).getAll();request.onsuccess = () => resolve(request.result); }));
      database.close();
    }
    return JSON.stringify(values);
  });
  expect(stored).not.toContain(sourceMarker);expect(stored).not.toContain('data:image');expect(stored).not.toContain('blob:');
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.locator('section').filter({ hasText: 'Coming up · next 12 hours' }).getByRole('button', { name: /^Synthetic photo medicine/ }).first()).toBeVisible();
});

test('t. Photo caps, reader errors and the real local missing-key response are honest', async ({ page, sessions }) => {
  void sessions;
  const f = await family();await signIn(page, f.admin);await more(page, 'Medicine cabinet');
  await page.getByRole('button', { name: 'Add from a photo', exact: true }).click();
  const photo = await syntheticPhoto(page);
  await choosePhotos(page, Array.from({ length: 5 }, (_, i) => ({ ...photo, name: `synthetic-${i}.png` })));
  await expect(page.getByText('Only the first 4 photos were kept.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^View photo/ })).toHaveCount(4);
  for (const [status, body, message] of [
    [429, { code: 'prescription_limit_reached' }, "Today's limit for reading photos has been reached. Add the medicine by hand, or try again tomorrow."],
    [200, { is_prescription: false, medicines: [] }, 'I could not read this. Try again closer, with more light, and every word in view.'],
    [502, { code: 'reader_failed' }, 'Reading did not work this time. Try again, or take photos of fewer medicines at a time.'],
  ] as const) {
    await page.route('**/functions/v1/read-prescription', route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));
    await page.getByRole('button', { name: 'Read 4 photos', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(message);
    await page.unroute('**/functions/v1/read-prescription');
  }
  await page.getByRole('button', { name: 'Read 4 photos', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Reading photos is not set up on this server yet.');
  expect(await checked(f.admin.client.from('medicines').select('id').eq('household_id', f.id))).toHaveLength(0);
});

test('u. Failed cabinet loads cannot turn an existing medicine into a new photo addition', async ({ page, sessions }) => {
  void sessions;
  const f = await family();await checked(f.admin.client.from('medicines').insert({ household_id: f.id, name: 'Existing synthetic tablet' }));
  await signIn(page, f.admin);await more(page, 'Medicine cabinet');await expect(page.getByText('Existing synthetic tablet', { exact: true })).toBeVisible();
  await page.route('**/rest/v1/medicines*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic failure' }) }));
  await page.reload();await more(page, 'Medicine cabinet');
  await expect(page.getByText("Couldn't load medicines. Check the connection.", { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add from a photo', exact: true }).click();
  await choosePhotos(page, [await syntheticPhoto(page)]);
  await page.route('**/functions/v1/read-prescription', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ is_prescription: true, medicines: [photoMedicine({ name: 'Existing synthetic tablet', photos: [1] }), photoMedicine({ name: 'New synthetic tablet', photos: [1] })] }) }));
  await page.getByRole('button', { name: 'Read 1 photo', exact: true }).click();
  await expect(page.getByText('Your medicines could not be loaded, so the app cannot tell which of these you already have. Check the connection.', { exact: true })).toBeVisible();
  for (const button of await page.getByRole('button', { name: 'Check and add', exact: true }).all()) await expect(button).toBeDisabled();
  expect(await page.getByRole('button', { name: 'Check and add', exact: true }).count()).toBe(2);
  await page.unroute('**/rest/v1/medicines*');await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Already in your medicines: Existing synthetic tablet', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check and add', exact: true })).toBeEnabled();
  expect(await checked(f.admin.client.from('medicines').select('id').eq('household_id', f.id))).toHaveLength(1);
});
