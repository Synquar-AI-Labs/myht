import { test, expect, checked, family, signIn, more, today } from './helpers';

test('i. Recording stays private, survives account switches and retries without loss', async ({ page, sessions }) => {
  void sessions;
  const a = await family(); const b = await family();
  await signIn(page, a.admin); await more(page, 'Doctor conversations');
  await page.getByPlaceholder('Title (optional)').fill('Synthetic conversation');
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(page.getByText('Recording — keep the phone unlocked')).toBeVisible();
  // A real fake-device MediaRecorder must deliver a nonempty chunk before Stop.
  await expect(page.getByRole('button', { name: /Stop · 0:0[2-9]/ })).toBeVisible();
  await page.getByRole('button', { name: /^Stop ·/ }).click();
  await expect(page.getByText('Uploaded, but transcription failed. Your audio is safe.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('OPENAI_API_KEY is not configured');
  await expect(page.getByRole('button', { name: 'Try transcribing again', exact: true })).toBeVisible();
  const files = await checked(a.admin.client.storage.from('audio-files').list(a.id + '/' + today()));
  expect(files).toHaveLength(1);
  const path = `${a.id}/${today()}/${files![0].name}`;
  expect(files![0].name).toMatch(/^\d+\.webm$/);
  const audio = await checked(a.admin.client.storage.from('audio-files').download(path));
  expect(audio.size).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Try transcribing again', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('OPENAI_API_KEY is not configured');
  expect(await checked(a.admin.client.storage.from('audio-files').list(a.id + '/' + today()))).toHaveLength(1);
  expect(await checked(b.admin.client.storage.from('audio-files').list(a.id + '/' + today()))).toEqual([]);
  const foreignDownload = await b.admin.client.storage.from('audio-files').download(path);
  expect(foreignDownload.error).not.toBeNull(); expect(foreignDownload.data).toBeNull();

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: /^Sign out/ }).click();
  await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
  await signIn(page, b.admin); await more(page, 'Doctor conversations');
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeEnabled();
  await expect(page.getByPlaceholder('Title (optional)')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Try transcribing again', exact: true })).toHaveCount(0);
  expect(await checked(b.admin.client.storage.from('audio-files').list(b.id + '/' + today()))).toEqual([]);
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('myht-recordings', 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const entries = await new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction('pending').objectStore('pending').getAll();
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    db.close(); return entries;
  });
  expect(stored).toEqual([expect.objectContaining({ user_id: a.admin.id, household_id: a.id, storagePath: path })]);
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.getByRole('button', { name: /^Sign out/ }).click();
  await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
  await signIn(page, a.admin); await more(page, 'Doctor conversations');
  await expect(page.getByPlaceholder('Title (optional)')).toHaveValue('Synthetic conversation');
  await expect(page.getByRole('button', { name: 'Try transcribing again', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('Recovered an unfinished recording from your last session.');
});

test('j. Signing out mid-recording preserves captured audio only for its owner', async ({ page, sessions }) => {
  void sessions;
  const a = await family(); const b = await family();
  await signIn(page, a.admin); await more(page, 'Doctor conversations');
  await page.getByPlaceholder('Title (optional)').fill('Interrupted synthetic conversation');
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(page.getByRole('button', { name: /Stop · 0:0[2-9]/ })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: /^Sign out/ }).click();
  await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
  await signIn(page, b.admin); await more(page, 'Doctor conversations');
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0);
  expect(await checked(b.admin.client.storage.from('audio-files').list(b.id + '/' + today()))).toEqual([]);
  expect(await checked(a.admin.client.storage.from('audio-files').list(a.id + '/' + today()))).toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.getByRole('button', { name: /^Sign out/ }).click();
  await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
  await signIn(page, a.admin); await more(page, 'Doctor conversations');
  await expect(page.getByPlaceholder('Title (optional)')).toHaveValue('Interrupted synthetic conversation');
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download audio', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^conversation-.*\.webm$/);
});
