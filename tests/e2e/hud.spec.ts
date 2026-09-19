import { clickTile, expect, openGame, read, setTimeScale, test } from './fixtures/game';

// One desk here clears all five waves and still leaks in waves 4 and 5, so the uptime the HUD
// is being checked against actually moves. Verified headless: victory at seed 1234 with wave
// uptimes 20/20/20/17/9, and no loss across 60 seeds.
const DESK = { x: 4, y: 2 };

test("shows the sim's uptime after every wave of a full run", async ({ page }) => {
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
  expect((await read(page)).snapshot.phase).toBe('victory');
  // not a vacuous comparison: uptime really did move during the run
  expect(seen[seen.length - 1]).toBeLessThan(seen[0]);
});
