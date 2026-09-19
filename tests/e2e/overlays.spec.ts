import { clickTile, expect, openGame, playToEnd, read, setTimeScale, test, waitForBridge } from './fixtures/game';

const DESK = { x: 4, y: 2 };

test('shows the defeat overlay at uptime 0 and restarts into a new run', async ({ page }) => {
  await openGame(page, { fx: 'off' }); // no desks placed: every Typo leaks, defeat in wave 3
  await setTimeScale(page, 20);
  expect(await playToEnd(page)).toBe('defeat');

  await expect(page.getByTestId('overlay-defeat')).toBeVisible();
  await expect(page.getByTestId('overlay-victory')).toHaveCount(0);
  const ended = await read(page);
  expect(ended.snapshot.uptime).toBe(0);

  await page.getByTestId('restart').click();
  await waitForBridge(page); // the restart remounts the run, so the scene half reinstalls

  await expect.poll(async () => (await read(page)).snapshot.phase).toBe('build');
  const fresh = await read(page);
  expect(fresh.seed).not.toBe(ended.seed);
  expect(fresh.snapshot.uptime).toBe(fresh.snapshot.maxUptime);
  expect(fresh.snapshot.wave).toBe(1);
  expect(fresh.snapshot.desks).toEqual([]);
  await expect(page.getByTestId('overlay-defeat')).toHaveCount(0);
  await expect(page.getByTestId('start-sprint')).toBeEnabled();
});

test('shows the victory overlay after clearing wave 5 and restarts into a new run', async ({ page }) => {
  await openGame(page, { fx: 'off' });
  await clickTile(page, DESK.x, DESK.y);
  await expect.poll(async () => (await read(page)).stats.deskObjects).toBe(1);
  await setTimeScale(page, 20);
  expect(await playToEnd(page)).toBe('victory');

  await expect(page.getByTestId('overlay-victory')).toBeVisible();
  await expect(page.getByTestId('overlay-defeat')).toHaveCount(0);
  const ended = await read(page);
  expect(ended.snapshot.uptime).toBeGreaterThan(0);
  expect(ended.snapshot.wave).toBe(ended.snapshot.waveCount);

  await page.getByTestId('restart').click();
  await waitForBridge(page); // the restart remounts the run, so the scene half reinstalls

  await expect.poll(async () => (await read(page)).snapshot.phase).toBe('build');
  const fresh = await read(page);
  expect(fresh.seed).not.toBe(ended.seed);
  expect(fresh.snapshot.uptime).toBe(fresh.snapshot.maxUptime);
  expect(fresh.snapshot.wave).toBe(1);
  await expect(page.getByTestId('overlay-victory')).toHaveCount(0);
});
