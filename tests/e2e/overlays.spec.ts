import { clickTile, expect, openGame, playToEnd, read, setTimeScale, test, waitForBridge } from './fixtures/game';

// One desk here clears all five waves and still leaks in waves 4 and 5, so the uptime the HUD
// is being checked against actually moves. Verified headless: victory at seed 1234 with wave
// uptimes 20/20/20/17/9, and no loss across 60 seeds.
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

// The five-wave playback is the expensive half of this suite, so one run has to pay for both
// things it can prove: the HUD is read against the sim at every wave boundary on the way to the
// overlay this test is named for. (Merged from the former hud.spec.ts — same desk, same fx=off,
// same 20x scale, same run.)
test('tracks the sim in the HUD through five waves, shows the victory overlay, and restarts into a new run', async ({ page }) => {
  await openGame(page, { fx: 'off' });
  await clickTile(page, DESK.x, DESK.y);
  await expect.poll(async () => (await read(page)).stats.deskObjects).toBe(1);
  await setTimeScale(page, 20);

  const seen: number[] = [];
  for (let wave = 1; wave <= 5; wave += 1) {
    const started = (await read(page)).snapshot.wave;
    await page.getByTestId('start-sprint').click();
    // Wait for the wave's *result*, not for it to be caught in the act: the sim really
    // fast-forwards now, so a wave can begin and end between two polls and `running` is
    // never observed. The wave counter moving on (sim.ts advances it at wave end) or the
    // run ending is the same signal, and cannot be missed. Uptime is frozen either way,
    // so the HUD and the sim can still be compared without racing the tick.
    await expect.poll(async () => {
      const { phase, wave } = (await read(page)).snapshot;
      return wave > started || phase === 'victory' || phase === 'defeat';
    }, { timeout: 120_000 }).toBe(true);

    const { snapshot } = await read(page);
    await expect(page.getByTestId('uptime')).toHaveText(String(snapshot.uptime));
    await expect(page.getByTestId('wave')).toHaveText(String(snapshot.wave));
    seen.push(snapshot.uptime);
    if (snapshot.phase !== 'build') break;
  }

  expect(seen).toHaveLength(5);
  // not a vacuous comparison: uptime really did move during the run
  expect(seen[seen.length - 1]).toBeLessThan(seen[0]);

  await expect(page.getByTestId('overlay-victory')).toBeVisible();
  await expect(page.getByTestId('overlay-defeat')).toHaveCount(0);
  const ended = await read(page);
  expect(ended.snapshot.phase).toBe('victory');
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
