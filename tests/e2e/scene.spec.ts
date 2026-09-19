import { expect, openGame, setTimeScale, test } from './fixtures/game';

// This spec leaves fx on (the default) and drives a full running wave, so it doubles as the
// one place the post-processing stack — the thing the product always ships — is exercised
// under the `problems` fixture. run.spec.ts, which owns the "no console error" criterion,
// runs with fx off for speed and so never mounts EffectComposer; without this, nothing that
// takes `problems` would ever see a bug in that stack.
test('draws exactly one bug object per live bug', async ({ page, problems }) => {
  await openGame(page); // no desks: bugs pile up and none die
  // 2x, not 6x: this test samples the wave as it runs and needs ~30 windows to do it.
  // Now that timeScale is honoured rather than throttled to the frame rate, 6x finishes
  // the wave in about three seconds and leaves only a third of the samples it needs.
  await setTimeScale(page, 2);
  await page.getByTestId('start-sprint').click();

  const samples: { bugInstances: number; bugsLive: number }[] = [];
  await expect.poll(async () => {
    const { stats, phase } = await page.evaluate(() => ({
      stats: window.__ofp!.stats(),
      phase: window.__ofp!.snapshot().phase,
    }));
    if (phase === 'running') samples.push({ bugInstances: stats.bugInstances, bugsLive: stats.bugsLive });
    return samples.length;
  }, { intervals: [80], timeout: 120_000 }).toBeGreaterThanOrEqual(30);

  // the samples have to be worth something: most must have had bugs on the board
  expect(samples.filter((s) => s.bugsLive > 0).length).toBeGreaterThan(15);
  expect(samples.filter((s) => s.bugsLive !== s.bugInstances)).toEqual([]);
  expect(problems).toEqual([]);
});
