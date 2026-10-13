import { test, expect, family, signIn, insertMedicine } from './helpers';

test('ticker polling heals a silent live connection without focus or reload', async ({ page, sessions }) => {
  const f = await family();
  let silent = false;
  let subscribed = 0;
  await page.routeWebSocket('**/realtime/v1/websocket*', socket => {
    const server = socket.connectToServer();
    server.onMessage(message => {
      const [join_ref, ref, topic, event, payload] = JSON.parse(String(message));
      const body = { join_ref, ref, topic, event, payload };
      if (body.event === 'phx_reply' && body.payload?.status === 'ok' && body.topic?.includes('household-sync')) subscribed++;
      if (!silent || body.event !== 'postgres_changes') socket.send(message);
    });
  });
  await signIn(page, f.admin);
  await page.getByRole('button', { name: /^Record a medicine/ }).click();
  await expect.poll(() => subscribed).toBeGreaterThan(0);
  await insertMedicine(f.member, f.id, 'Visible positive control');
  await expect(page.getByRole('button', { name: /^Visible positive control/ })).toBeVisible();
  const second = await sessions(); await signIn(second, f.member);
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  expect(await page.evaluate(() => document.visibilityState)).toBe('visible');
  silent = true;
  await insertMedicine(f.member, f.id, 'Recovered by ticker');
  await expect(page.getByRole('button', { name: /^Record a medicine All 2 medicines/ })).toBeVisible({ timeout: 40_000 });
  const medicineList = page.getByRole('button', { name: /^Record a medicine/ });
  if (await medicineList.getAttribute('aria-expanded') === 'false') await medicineList.click();
  await expect(page.getByRole('button', { name: /^Recovered by ticker/ })).toBeVisible({ timeout: 40_000 });
  expect(navigations, 'recovery must not reload the page').toBe(0);
});

test('an orderly server channel close rejoins and resumes live updates', async ({ page, sessions }) => {
  const f = await family();
  let subscribed = 0;
  let closeChannel: (() => void) | undefined;
  let currentTopic = '';
  let countRepairedEvents = false;
  let repairedEvents = 0;
  await page.routeWebSocket('**/realtime/v1/websocket*', socket => {
    const server = socket.connectToServer();
    server.onMessage(message => {
      const [join_ref, ref, topic, event, payload] = JSON.parse(String(message));
      const body = { join_ref, ref, topic, event, payload };
      if (body.event === 'phx_reply' && body.payload?.status === 'ok' && body.topic?.includes('household-sync')) {
        subscribed++;
        currentTopic = body.topic;
        closeChannel = () => socket.send(JSON.stringify([body.join_ref, null, body.topic, 'phx_close', {}]));
      }
      socket.send(message);
      if (countRepairedEvents && body.topic === currentTopic && body.event === 'postgres_changes') repairedEvents++;
    });
  });
  await signIn(page, f.admin);
  await page.getByRole('button', { name: /^Record a medicine/ }).click();
  await expect.poll(() => subscribed).toBeGreaterThan(0);
  await insertMedicine(f.member, f.id, 'Before channel close');
  await expect(page.getByRole('button', { name: /^Before channel close/ })).toBeVisible();
  const second = await sessions(); await signIn(second, f.member);
  const before = subscribed;
  closeChannel!();
  await expect.poll(() => subscribed).toBeGreaterThan(before);
  countRepairedEvents = true;
  await insertMedicine(f.member, f.id, 'After channel repair');
  await expect.poll(() => repairedEvents, { timeout: 10_000, message: 'the repaired channel must forward a live change' }).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /^After channel repair/ })).toBeVisible({ timeout: 10_000 });
});
