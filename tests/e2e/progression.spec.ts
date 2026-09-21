import type { Page } from '@playwright/test';
import {
  awaitTicks, clickTile, earnXp, expect, openGame, pollState, read, select, setTimeScale, test,
  waitForBridge,
} from './fixtures/game';
import { formatPrice, formatStat, formatTitle } from '../../src/ui/format';

// MILESTONE_1_BOARD, 12x9. Every tile clicked here is well left of the bottom-right inspector
// panel, so a board click is never intercepted by the panel's own DOM.
const DESK = { x: 4, y: 2 };
const SECOND = { x: 8, y: 2 };
const DESTINATION = { x: 3, y: 3 };
const PATH = { x: 4, y: 1 };

type Snap = Awaited<ReturnType<typeof read>>['snapshot'];

function deskOf(snap: Snap, id: number) {
  const desk = snap.desks.find((d) => d.id === id);
  if (!desk) throw new Error(`no desk ${id} in the snapshot`);
  return desk;
}

/** Earns and spends up to `level` on `path`, asserting nothing about the rungs passed through —
 *  this is setup for the rung the test is actually about. */
async function buyUpTo(
  page: Page,
  deskId: number,
  path: 'craft' | 'process',
  level: number,
): Promise<void> {
  for (;;) {
    const desk = deskOf((await read(page)).snapshot, deskId);
    if (desk[path] >= level) return;
    const price = desk.nextPrice[path];
    if (price === null) throw new Error(`${path} is locked at ${desk[path]}, cannot reach ${level}`);
    await earnXp(page, deskId, price);
    await page.getByTestId(`buy-${path}`).click();
    await expect
      .poll(async () => deskOf((await read(page)).snapshot, deskId)[path])
      .toBe(desk[path] + 1);
  }
}

test('selects a desk on click, leaves it standing, and reads its snapshot back out of the inspector',
  { tag: '@fast' }, async ({ page, problems }) => {
    await openGame(page, { fx: 'off' });
    await clickTile(page, DESK.x, DESK.y);
    await expect.poll(pollState(page, (s) => s.stats.deskObjects, problems)).toBe(1);

    await clickTile(page, DESK.x, DESK.y); // milestone 1 sent RemoveDesk here

    await expect(page.getByTestId('inspector')).toBeVisible();
    const { snapshot } = await read(page);
    expect(snapshot.desks).toHaveLength(1);
    const desk = snapshot.desks[0];
    await expect(page.getByTestId('inspector')).toHaveAttribute('data-desk', String(desk.id));
    await expect(page.getByTestId('desks-remaining')).toHaveText(String(snapshot.deskBudget - 1));

    await expect(page.getByTestId('inspector-title')).toHaveText(formatTitle(desk.title));
    await expect(page.getByTestId('inspector-xp')).toHaveText(formatStat(desk.xp));
    await expect(page.getByTestId('inspector-damage')).toHaveText(formatStat(desk.damage));
    await expect(page.getByTestId('inspector-range')).toHaveText(formatStat(desk.range));
    await expect(page.getByTestId('level-craft')).toHaveText(String(desk.craft));
    await expect(page.getByTestId('level-process')).toHaveText(String(desk.process));
    await expect(page.getByTestId('price-craft')).toHaveText(formatPrice(desk.nextPrice.craft));
    await expect(page.getByTestId('price-process')).toHaveText(formatPrice(desk.nextPrice.process));
    // the two price assertions above compared real numbers, not two em dashes
    expect(desk.nextPrice.craft).not.toBeNull();
    expect(desk.nextPrice.process).not.toBeNull();

    // Deselecting is what keeps the build phase usable: with a desk selected an empty tile is a
    // destination, so placing the next hire has to be reachable again.
    await page.getByTestId('inspector-close').click();
    await expect(page.getByTestId('inspector')).toHaveCount(0);
    await clickTile(page, SECOND.x, SECOND.y);
    await expect.poll(pollState(page, (s) => s.stats.deskObjects, problems)).toBe(2);

    expect(problems).toEqual([]);
  });

/** The narrative half of the "buys levels" test — everything from placing the desk through the
 *  cap-crossing purchase. Split out so the test can retry it wholesale (see the caller): this
 *  scenario's 120 xp minimum is only barely under waves 1-4's combined yield, and which real
 *  tick each click lands on (the sim advances on real elapsed time) is enough to occasionally
 *  push part of that into wave 5, where a shortfall can no longer be made up — the last wave
 *  ends the run outright rather than returning to a build phase to spend anything in. */
async function runPurchaseFlow(page: Page, problems: string[]): Promise<void> {
  await clickTile(page, DESK.x, DESK.y);
  await expect.poll(pollState(page, (s) => s.stats.deskObjects, problems)).toBe(1);
  await setTimeScale(page, 20);
  const deskId = (await read(page)).snapshot.desks[0].id;
  await select(page, deskId);

  // --- the purchase debits the price the panel was showing, and the panel says so
  await earnXp(page, deskId, Number(await page.getByTestId('price-craft').textContent()));
  const before = deskOf((await read(page)).snapshot, deskId);
  const price = Number(await page.getByTestId('price-craft').textContent());
  expect(price).toBe(before.nextPrice.craft);

  await page.getByTestId('buy-craft').click();

  await expect.poll(pollState(page, (s) => deskOf(s.snapshot, deskId).craft, problems)).toBe(1);
  const bought = deskOf((await read(page)).snapshot, deskId);
  expect(bought.xp).toBe(before.xp - price);
  // One HUD sync interval is 200ms. The short explicit timeout is the point: this asserts the
  // panel follows the sim, not that it gets there eventually.
  await expect(page.getByTestId('level-craft')).toHaveText('1', { timeout: 3_000 });
  await expect(page.getByTestId('inspector-xp'))
    .toHaveText(formatStat(bought.xp), { timeout: 3_000 });
  await expect(page.getByTestId('inspector-title')).toHaveText(formatTitle(bought.title));
  expect(bought.title).not.toBe(''); // the title assertion above is not comparing two fallbacks

  // --- the ground ring is drawn at the radius the snapshot buffs at
  expect((await read(page)).stats.auras).toEqual([]);
  await buyUpTo(page, deskId, 'process', 1);
  const { auraRadius } = deskOf((await read(page)).snapshot, deskId);
  expect(auraRadius).toBeGreaterThan(0);
  await expect.poll(pollState(page, (s) => s.stats.auras, problems))
    .toEqual([{ deskId, radius: auraRadius }]);

  // --- at the cap, the next rung is marked as the one that closes the fork
  await expect(page.getByTestId('lock-process')).toHaveCount(0);
  await buyUpTo(page, deskId, 'process', 2);
  await expect(page.getByTestId('lock-process')).toBeVisible();
  await expect(page.getByTestId('lock-craft')).toHaveCount(0); // craft is still below the cap

  // --- crossing the cap on craft closes process for good
  await buyUpTo(page, deskId, 'craft', 3);
  const locked = deskOf((await read(page)).snapshot, deskId);
  expect(locked.lockedPath).toBe('process');
  expect(locked.process).toBe(2);
  await expect(page.getByTestId('price-process')).toHaveText(formatPrice(null));
  await expect(page.getByTestId('buy-process')).toBeDisabled();
  await expect(page.getByTestId('lock-process')).toHaveCount(0); // closed, not closing

  await page.getByTestId('buy-process').click({ force: true });
  await awaitTicks(page);
  const after = deskOf((await read(page)).snapshot, deskId);
  expect(after.process).toBe(locked.process);
  expect(after.xp).toBe(locked.xp);
}

test('buys levels, marks the purchase that forecloses the other path, refuses the capped one, and rings the aura at the radius it buffs at',
  async ({ page, problems }) => {
    await openGame(page, { fx: 'off' });

    // A single desk's early-wave kill count is sensitive to exactly which real tick each click
    // lands on (the sim advances on real elapsed time), so on a rare run more of waves 1-4
    // leaks than this scenario's 120 xp minimum needs — and if that shortfall is only made up
    // during wave 5, the run ends in victory before a build phase exists to spend it in
    // (sim.ts skips straight from the last wave's combat to 'victory'). A fresh seed is the
    // same recovery a player has: play again. Bounded so a genuine regression still fails
    // instead of retrying forever, and every criterion is still checked in full on whichever
    // attempt succeeds.
    for (let attempt = 1; ; attempt += 1) {
      try {
        await runPurchaseFlow(page, problems);
        break;
      } catch (e) {
        if (attempt >= 4 || !/^run ended in (victory|defeat)/.test((e as Error).message)) throw e;
        await page.getByTestId('restart').click();
        await waitForBridge(page);
      }
    }

    expect(problems).toEqual([]);
  });

test('moves a selected desk for the cost it showed, ignores an invalid destination, and removes only on confirmation',
  async ({ page, problems }) => {
    await openGame(page, { fx: 'off' });
    await clickTile(page, DESK.x, DESK.y);
    await expect.poll(pollState(page, (s) => s.stats.deskObjects, problems)).toBe(1);
    await setTimeScale(page, 20);
    const deskId = (await read(page)).snapshot.desks[0].id;
    await select(page, deskId);

    // a move has to cost something before "debits what it showed" means anything
    await earnXp(page, deskId, 8);
    const before = deskOf((await read(page)).snapshot, deskId);
    // earnXp returns the instant the sim reaches build phase with enough xp, which can be ahead
    // of the desk store's own HUD_SYNC_MS publish — wait for the panel to have caught up to
    // `before` (the same discipline the buy assertions above already apply) before trusting what
    // it displays as "the cost it showed".
    await expect(page.getByTestId('inspector-xp'))
      .toHaveText(formatStat(before.xp), { timeout: 3_000 });
    const cost = Number(await page.getByTestId('inspector-move-cost').textContent());
    expect(cost).toBeGreaterThan(0);

    await clickTile(page, PATH.x, PATH.y); // a corridor tile is no destination at all
    await awaitTicks(page);
    const refused = deskOf((await read(page)).snapshot, deskId);
    expect({ x: refused.x, y: refused.y, xp: refused.xp })
      .toEqual({ x: before.x, y: before.y, xp: before.xp });
    await expect(page.getByTestId('inspector')).toHaveAttribute('data-desk', String(deskId));

    await clickTile(page, DESTINATION.x, DESTINATION.y);
    await expect
      .poll(pollState(page, (s) => deskOf(s.snapshot, deskId).x, problems))
      .toBe(DESTINATION.x);
    const moved = deskOf((await read(page)).snapshot, deskId);
    expect({ x: moved.x, y: moved.y }).toEqual({ x: DESTINATION.x, y: DESTINATION.y });
    expect(moved.xp).toBe(before.xp - cost);

    // --- one click arms the removal; it does not destroy
    await page.getByTestId('remove-desk').click();
    await expect(page.getByTestId('confirm-remove')).toBeVisible();
    await awaitTicks(page);
    const armed = await read(page);
    expect(armed.snapshot.desks).toHaveLength(1);
    await expect(page.getByTestId('desks-remaining'))
      .toHaveText(String(armed.snapshot.deskBudget - 1));

    await page.getByTestId('confirm-remove').click();

    await expect.poll(pollState(page, (s) => s.stats.deskObjects, problems)).toBe(0);
    const gone = await read(page);
    expect(gone.snapshot.desks).toEqual([]);
    await expect(page.getByTestId('desks-remaining')).toHaveText(String(gone.snapshot.deskBudget));
    await expect(page.getByTestId('inspector')).toHaveCount(0);

    expect(problems).toEqual([]);
  });
