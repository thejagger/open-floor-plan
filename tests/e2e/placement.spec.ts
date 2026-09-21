import { clickTile, expect, openGame, pollState, read, tiles, test } from './fixtures/game';

/** Where the desks are, without the combat state that legitimately moves mid-wave. */
const placement = (snap: { desks: { id: number; role: string; x: number; y: number }[] }) =>
  snap.desks.map(({ id, role, x, y }) => ({ id, role, x, y }));

// MILESTONE_1_BOARD, 12x9. Four free tiles, and one tile that is on the path.
const EMPTY = { x: 3, y: 0 };
const SECOND = { x: 5, y: 3 };
const THIRD = { x: 8, y: 2 };
const FOURTH = { x: 10, y: 1 };
const PATH = { x: 4, y: 1 };

test('places a desk on an empty non-path tile and draws it', { tag: '@fast' }, async ({ page, problems }) => {
  await openGame(page, { fx: 'off' });
  const before = await read(page);
  expect(before.snapshot.desks).toEqual([]);
  expect(before.stats.deskObjects).toBe(0);

  await clickTile(page, EMPTY.x, EMPTY.y);

  await expect.poll(pollState(page, (s) => s.stats.deskObjects, problems)).toBe(1);
  const after = await read(page);
  expect(after.snapshot.desks).toHaveLength(1);
  expect(after.snapshot.desks[0]).toMatchObject({ x: EMPTY.x, y: EMPTY.y, role: 'developer' });
  await expect(page.getByTestId('desks-remaining'))
    .toHaveText(String(before.snapshot.deskBudget - 1));
});

test('places nothing on a path tile, and nothing once the budget is spent', { tag: '@fast' }, async ({ page, problems }) => {
  await openGame(page, { fx: 'off' });

  await clickTile(page, PATH.x, PATH.y);
  // the next click is submitted on a later tick, so by the time its desk appears the path
  // click has had every chance to produce one — no sleep needed
  await clickTile(page, EMPTY.x, EMPTY.y);
  await expect.poll(pollState(page, (s) => s.stats.deskObjects, problems)).toBe(1);
  expect(tiles((await read(page)).snapshot)).toEqual(['3,0']);

  await clickTile(page, SECOND.x, SECOND.y);
  await clickTile(page, THIRD.x, THIRD.y);
  await expect.poll(pollState(page, (s) => s.stats.deskObjects, problems)).toBe(3);

  await clickTile(page, FOURTH.x, FOURTH.y);
  await clickTile(page, FOURTH.x, FOURTH.y); // twice: the second lands after the first was refused
  const after = await read(page);
  expect(tiles(after.snapshot)).toEqual(['3,0', '5,3', '8,2']);
  expect(after.snapshot.desksPlaced).toBe(after.snapshot.deskBudget);
  expect(after.stats.deskObjects).toBe(3);
  await expect(page.getByTestId('desks-remaining')).toHaveText('0');
});

test('removes a desk that is clicked again and returns it to the budget', { tag: '@fast' }, async ({ page, problems }) => {
  await openGame(page, { fx: 'off' });
  await clickTile(page, EMPTY.x, EMPTY.y);
  await expect.poll(pollState(page, (s) => s.stats.deskObjects, problems)).toBe(1);

  await clickTile(page, EMPTY.x, EMPTY.y);

  await expect.poll(pollState(page, (s) => s.stats.deskObjects, problems)).toBe(0);
  const after = await read(page);
  expect(after.snapshot.desks).toEqual([]);
  expect(after.snapshot.desksPlaced).toBe(0);
  await expect(page.getByTestId('desks-remaining')).toHaveText(String(after.snapshot.deskBudget));
});

test('ignores clicks while a wave is running', { tag: '@fast' }, async ({ page, problems }) => {
  await openGame(page, { fx: 'off' });
  await clickTile(page, EMPTY.x, EMPTY.y);
  await expect.poll(pollState(page, (s) => s.stats.deskObjects, problems)).toBe(1);

  await page.getByTestId('start-sprint').click();
  await expect.poll(pollState(page, (s) => s.snapshot.phase, problems)).toBe('running');
  const before = await read(page);

  await clickTile(page, SECOND.x, SECOND.y); // an otherwise valid empty tile
  await clickTile(page, EMPTY.x, EMPTY.y); // the desk itself — no removal either
  await clickTile(page, SECOND.x, SECOND.y);

  const after = await read(page);
  expect(after.snapshot.phase).toBe('running');
  // bugs and uptime move while a wave runs; the placement half of the snapshot must not.
  // Compared field by field rather than whole: a desk also carries `cooldownRemaining`,
  // which ticks down whenever it fires, so a whole-object match would fail the moment the
  // desk shoots — a combat detail, not a placement one.
  expect(placement(after.snapshot)).toEqual(placement(before.snapshot));
  expect(after.snapshot.desksPlaced).toBe(1);
  expect(after.stats.deskObjects).toBe(1);
});
