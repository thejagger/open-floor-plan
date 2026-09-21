import { clickTile, expect, openGame, playToEnd, read, setTimeScale, test } from './fixtures/game';

// Deliberately leaves fx on (the default). This spec owns the "no uncaught exception and no
// console error" criterion, so it has to certify the render stack the product actually ships,
// post-processing included. It is also the only place combat juice — tracers, death pops,
// damage numbers, camera shake — is ever drawn with EffectComposer mounted: scene.spec runs
// with effects on but places no desks, so nothing there ever dies. Bloom is the pass that
// reads those bright pixels, which makes this the combination most worth certifying.
// Measured cost of keeping effects on here: 25.7s vs 14.9s with them off.
test('plays a full five-wave run with no uncaught exception and no console error',
  async ({ page, problems }) => {
    await openGame(page);
    await clickTile(page, 4, 2);
    await expect.poll(async () => (await read(page)).stats.deskObjects).toBe(1);
    await setTimeScale(page, 20);

    expect(await playToEnd(page)).toBe('victory');

    const { snapshot, stats } = await read(page);
    expect(snapshot.wave).toBe(snapshot.waveCount);
    // It really rendered; it did not stall. The bar is frames, not a rate: under SwiftShader
    // at the vsync-capped cadence the launch flags now use (see playwright.config.ts) a
    // fast-forwarded five-wave run renders ~58 frames with post-processing on (~80 without).
    // A victory already implies ~14 frames via the catch-up cap, so the band this actually
    // catches is a loop degraded to a few fps — measured margin here is 58 against 30.
    expect(stats.frame).toBeGreaterThan(30);
    expect(problems).toEqual([]);
  });
