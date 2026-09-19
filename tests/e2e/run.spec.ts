import { clickTile, expect, openGame, playToEnd, read, setTimeScale, test } from './fixtures/game';

test('plays a full five-wave run with no uncaught exception and no console error',
  async ({ page, problems }) => {
    await openGame(page, { fx: 'off' });
    await clickTile(page, 4, 2);
    await expect.poll(async () => (await read(page)).stats.deskObjects).toBe(1);
    await setTimeScale(page, 20);

    expect(await playToEnd(page)).toBe('victory');

    const { snapshot, stats } = await read(page);
    expect(snapshot.wave).toBe(snapshot.waveCount);
    // It really rendered; it did not stall. The bar is frames, not a rate: under SwiftShader
    // at the vsync-capped cadence the launch flags now use (see playwright.config.ts) a
    // fast-forwarded five-wave run renders of the order of 80 frames, where a stalled loop
    // renders the two or three the bridge waited for before giving up.
    expect(stats.frame).toBeGreaterThan(30);
    expect(problems).toEqual([]);
  });
