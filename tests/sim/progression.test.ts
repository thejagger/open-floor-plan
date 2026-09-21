import { describe, expect, it } from 'vitest';
import { createRun, tick } from '../../src/sim/sim';
import { snapshot } from '../../src/sim/snapshot';
import { createDesk } from '../../src/sim/entities';
import { bestAura, effectiveStats, titleOf } from '../../src/sim/progression';
import { DEVELOPER } from '../../src/content/roles';
import { MILESTONE_2_PROGRESSION as TABLE } from '../../src/content/progression';
import { allEvents, bugStats, record, runConfig, straightBoard, wave } from '../helpers/sim';
import type { Command } from '../../src/sim/commands';
import type { Desk } from '../../src/sim/entities';
import type { XpGained } from '../../src/sim/events';
import type { Path } from '../../src/sim/progression';
import type { RunState } from '../../src/sim/sim';

/** A 20x9 board whose path runs along y=1, so a desk parked at y>=5 can never reach a bug. */
const board = () => straightBoard(20, 9);

/** Hand a placed desk XP without playing a wave for it. */
const grant = (run: RunState, xp: number): RunState => ({
  ...run,
  desks: run.desks.map((d) => ({ ...d, xp })),
});

/** Put one desk at an exact (craft, process, xp) without buying the ladder up to it. */
const at = (run: RunState, fields: Partial<Desk>): RunState => ({
  ...run,
  desks: [{ ...run.desks[0], ...fields }],
});

const xpFor = (events: readonly ReturnType<typeof allEvents>[number][], deskId: number) =>
  events.filter((e): e is XpGained => e.type === 'XpGained' && e.deskId === deskId);

describe('XP from kills', () => {
  it('credits the killing desk the bug xp in full, and credits a desk that kills nothing nothing', () => {
    const config = runConfig(board(), [wave(3, { bug: bugStats({ hp: 1, speed: 1, xp: 7 }) })]);
    // (9,3) is 2.0 from the path and inside DEVELOPER.range; (5,8) is 7.0 away and never fires.
    const started = tick(createRun(config, 3), [
      { type: 'PlaceDesk', x: 9, y: 3 },
      { type: 'PlaceDesk', x: 5, y: 8 },
      { type: 'StartSprint' },
    ]).run;
    expect(started.desks).toHaveLength(2);

    const { run, frames } = record(started, (r) => r.phase !== 'running');
    const events = allEvents(frames);

    expect(events.filter((e) => e.type === 'BugKilled')).toHaveLength(3);
    expect(xpFor(events, 1).map((e) => ({ amount: e.amount, total: e.total, source: e.source })))
      .toEqual([
        { amount: 7, total: 7, source: 'kill' },
        { amount: 7, total: 14, source: 'kill' },
        { amount: 7, total: 21, source: 'kill' },
      ]);
    expect(xpFor(events, 2)).toEqual([]);
    expect(run.desks[0].xp).toBe(21);
    expect(run.desks[1].xp).toBe(0);
  });
});

describe('XP from an aura', () => {
  // process 2: auraRadius 2.5, auraMultiplier 1.25. The mentor sits at (9,5): 2.0 from the
  // killer at (9,3) so the aura reaches, and 4.0 from the path so it can never kill anything
  // itself — which is what makes the assist the only XP it could possibly have.
  const mentorRun = (killerX: number) => {
    const config = runConfig(board(), [wave(3, { bug: bugStats({ hp: 1, speed: 1, xp: 8 }) })]);
    const placed = tick(createRun(config, 3), [
      { type: 'PlaceDesk', x: killerX, y: 3 },
      { type: 'PlaceDesk', x: 9, y: 5 },
    ]).run;
    const funded = grant(placed, 100);
    return tick(funded, [
      { type: 'BuyLevel', deskId: 2, path: 'process' },
      { type: 'BuyLevel', deskId: 2, path: 'process' },
      { type: 'StartSprint' },
    ]).run;
  };

  it('credits the aura owner assistFraction of every kill its aura enabled', () => {
    const started = mentorRun(9);
    expect(started.desks[1].process).toBe(2);

    const { run, frames } = record(started, (r) => r.phase !== 'running');
    const events = allEvents(frames);
    const assists = xpFor(events, 2);

    expect(events.filter((e) => e.type === 'BugKilled')).toHaveLength(3);
    expect(assists).toHaveLength(3);
    expect(assists.every((e) => e.source === 'assist')).toBe(true);
    expect(assists.map((e) => e.amount)).toEqual([4, 4, 4]); // 8 * assistFraction 0.5
    expect(run.desks[1].xp).toBe(started.desks[1].xp + 12);
    expect(run.desks[0].xp).toBe(started.desks[0].xp + 24); // the killer still earns in full, on top of its starting xp
  });

  it('credits a process desk nothing while no other desk stands in its aura', () => {
    const started = mentorRun(2); // killer moved to (2,3): 7.3 from the mentor, aura reaches 2.5
    const { run, frames } = record(started, (r) => r.phase !== 'running');
    const events = allEvents(frames);

    expect(events.filter((e) => e.type === 'BugKilled')).toHaveLength(3);
    expect(xpFor(events, 2)).toEqual([]);
    expect(run.desks[1].xp).toBe(started.desks[1].xp);
  });
});

describe('BuyLevel', () => {
  const placed = () =>
    tick(createRun(runConfig(board(), [wave(1)]), 1), [{ type: 'PlaceDesk', x: 4, y: 0 }]).run;

  it('debits the price and raises that path by one', () => {
    const price = TABLE.craft[0].price;
    const funded = grant(placed(), price);
    const bought = tick(funded, [{ type: 'BuyLevel', deskId: 1, path: 'craft' }]);

    expect(bought.run.desks[0]).toMatchObject({ craft: 1, process: 0, xp: 0 });
    expect(bought.events).toEqual([
      { type: 'LevelUp', deskId: 1, path: 'craft', level: 1, title: TABLE.titles.craft[0] },
    ]);
  });

  it('rejects a purchase the desk cannot afford and changes nothing', () => {
    const broke = grant(placed(), TABLE.craft[0].price - 1);
    const quiet = tick(broke, []);
    const noisy = tick(broke, [{ type: 'BuyLevel', deskId: 1, path: 'craft' }]);

    expect(noisy.run).toEqual(quiet.run); // no partial debit, no level change
    expect(noisy.events).toEqual(quiet.events);
  });
});

describe('the cross-path cap', () => {
  const cap = TABLE.crossPathCap;
  const top = TABLE.craft.length;
  const rich = () =>
    grant(tick(createRun(runConfig(board(), [wave(1)]), 1), [{ type: 'PlaceDesk', x: 4, y: 0 }]).run, 100_000);
  const buy = (run: RunState, path: Path, times: number): RunState => {
    let current = run;
    for (let i = 0; i < times; i += 1) {
      current = tick(current, [{ type: 'BuyLevel', deskId: 1, path }]).run;
    }
    return current;
  };

  it('holds in both directions: past the cap on one path stops the other at the cap', () => {
    const craftFirst = buy(buy(rich(), 'craft', 3), 'process', 3);
    expect(craftFirst.desks[0]).toMatchObject({ craft: 3, process: cap });

    const processFirst = buy(buy(rich(), 'process', 3), 'craft', 3);
    expect(processFirst.desks[0]).toMatchObject({ process: 3, craft: cap });
  });

  it('reaches 5 and 2 in either order and never 3 in both, over every purchase order', () => {
    // Breadth-first over the actual command, not over a restatement of the rule: every state
    // reachable by any sequence of BuyLevel from a blank hire, with XP never the constraint.
    const seen = new Map<string, RunState>([['0,0', rich()]]);
    const queue = [...seen.values()];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const path of ['craft', 'process'] as const) {
        const after = tick(current, [{ type: 'BuyLevel', deskId: 1, path }]).run;
        const d = after.desks[0];
        const key = `${d.craft},${d.process}`;
        if (seen.has(key)) continue;
        seen.set(key, after);
        queue.push(after);
      }
    }
    const reached = [...seen.keys()].map((k) => k.split(',').map(Number));

    expect(reached.some(([c, p]) => c === top && p === cap)).toBe(true);
    expect(reached.some(([c, p]) => p === top && c === cap)).toBe(true);
    expect(reached.filter(([c, p]) => c > cap && p > cap)).toEqual([]);
    expect(reached.every(([c, p]) => c <= top && p <= top)).toBe(true);
  });
});

describe('titleOf', () => {
  it('names the deeper path, craft on a tie, and nothing at all for a blank hire', () => {
    const desk = createDesk(1, { x: 4, y: 0 }, DEVELOPER);
    expect(titleOf({ ...desk, craft: 3, process: 1 }, TABLE)).toBe(TABLE.titles.craft[2]);
    expect(titleOf({ ...desk, craft: 1, process: 3 }, TABLE)).toBe(TABLE.titles.process[2]);
    expect(titleOf({ ...desk, craft: 2, process: 2 }, TABLE)).toBe(TABLE.titles.craft[1]);
    expect(titleOf(desk, TABLE)).toBe('');
  });
});

describe('effective stats', () => {
  it('multiplies craft damage by its own process multiplier and the aura, and leaves range and fire rate to craft', () => {
    const config = runConfig(board(), [wave(1, { bug: bugStats({ hp: 10_000, speed: 1 }) })]);
    // (9,3) fires (2.0 from the path); the mentor at (9,5) is 4.0 from the path and never fires.
    const placed = tick(createRun(config, 5), [
      { type: 'PlaceDesk', x: 9, y: 3 },
      { type: 'PlaceDesk', x: 9, y: 5 },
    ]).run;
    const built = tick(grant(placed, 100_000), [
      { type: 'BuyLevel', deskId: 1, path: 'craft' },
      { type: 'BuyLevel', deskId: 1, path: 'craft' },   // craft 2
      { type: 'BuyLevel', deskId: 1, path: 'process' },
      { type: 'BuyLevel', deskId: 1, path: 'process' }, // process 2
      { type: 'BuyLevel', deskId: 2, path: 'process' },
      { type: 'BuyLevel', deskId: 2, path: 'process' },
      { type: 'BuyLevel', deskId: 2, path: 'process' }, // mentor: process 3
    ]).run;
    expect(built.desks[0]).toMatchObject({ craft: 2, process: 2 });
    expect(built.desks[1]).toMatchObject({ craft: 0, process: 3 });

    const craft = TABLE.craft[1];
    const expected = craft.damage * TABLE.process[1].ownDamageMultiplier * TABLE.process[2].auraMultiplier;
    const stats = effectiveStats(built.desks[0], built.desks, TABLE);
    expect(stats.damage).toBeCloseTo(expected, 10);
    expect(stats.range).toBe(craft.range);
    expect(stats.cooldownTicks).toBe(craft.cooldownTicks);
    // range and fire rate are craft's alone: the same craft level with no process and no aura
    const bare = { ...built.desks[0], process: 0 };
    expect(effectiveStats(bare, [bare], TABLE)).toMatchObject({ range: craft.range, cooldownTicks: craft.cooldownTicks });

    // and the fire step actually uses it, rather than the stats stored on the desk
    const { frames } = record(tick(built, [{ type: 'StartSprint' }]).run, (r) => r.phase !== 'running');
    const damaged = allEvents(frames).filter((e) => e.type === 'BugDamaged');
    expect(damaged.length).toBeGreaterThan(0);
    expect(damaged[0].damage).toBeCloseTo(expected, 10);
    expect(built.desks[0].damage).toBe(DEVELOPER.damage); // base, unchanged on the record
  });
});

describe('auras', () => {
  const desk = (id: number, x: number, y: number, fields: Partial<Desk> = {}): Desk => ({
    ...createDesk(id, { x, y }, DEVELOPER),
    ...fields,
  });

  it('applies the stronger multiplier rather than the product when two auras overlap', () => {
    const target = desk(1, 9, 3);
    const weaker = desk(2, 9, 5, { process: 2 });  // radius 2.5, reaches 2.0 away
    const stronger = desk(3, 11, 5, { process: 3 }); // radius 3.0, reaches 2.83 away
    const all = [target, weaker, stronger];

    expect(bestAura(target, all, TABLE)).toEqual({
      deskId: 3, radius: TABLE.process[2].auraRadius, multiplier: TABLE.process[2].auraMultiplier,
    });
    expect(effectiveStats(target, all, TABLE).damage)
      .toBeCloseTo(DEVELOPER.damage * TABLE.process[2].auraMultiplier, 10);
    // not the product of the two
    expect(effectiveStats(target, all, TABLE).damage).not.toBeCloseTo(
      DEVELOPER.damage * TABLE.process[1].auraMultiplier * TABLE.process[2].auraMultiplier, 10,
    );
  });

  it('resolves equal multipliers to the lower entity id whichever order the desks are listed', () => {
    const target = desk(1, 9, 3);
    const low = desk(2, 9, 5, { process: 2 });
    const high = desk(7, 7, 4, { process: 2 }); // 2.24 away, inside radius 2.5
    expect(bestAura(target, [target, low, high], TABLE)?.deskId).toBe(2);
    expect(bestAura(target, [target, high, low], TABLE)?.deskId).toBe(2);
  });

  it('never buffs a desk with its own aura', () => {
    const lone = desk(1, 9, 3, { process: 3 });
    expect(bestAura(lone, [lone], TABLE)).toBeNull();
    expect(effectiveStats(lone, [lone], TABLE).damage)
      .toBeCloseTo(DEVELOPER.damage * TABLE.process[2].ownDamageMultiplier, 10);
  });
});

describe('MoveDesk', () => {
  const placed = () =>
    tick(createRun(runConfig(board(), [wave(1)]), 1), [
      { type: 'PlaceDesk', x: 4, y: 0 },
      { type: 'PlaceDesk', x: 6, y: 0 },
    ]).run;

  it('relocates the desk and charges floor(xp * moveCostFraction) of its unspent XP', () => {
    const funded = at(placed(), { xp: 37 }); // 37 * 0.25 = 9.25 -> 9
    const moved = tick(funded, [{ type: 'MoveDesk', deskId: 1, x: 10, y: 6 }]);

    expect(moved.run.desks[0]).toMatchObject({ id: 1, x: 10, y: 6, xp: 28 });
    expect(moved.events).toEqual([{ type: 'DeskMoved', deskId: 1, x: 10, y: 6, xpSpent: 9 }]);
  });

  it('moves a desk with no XP for free', () => {
    const broke = at(placed(), { xp: 0 });
    const moved = tick(broke, [{ type: 'MoveDesk', deskId: 1, x: 10, y: 6 }]);

    expect(moved.run.desks[0]).toMatchObject({ x: 10, y: 6, xp: 0 });
    expect(moved.events).toEqual([{ type: 'DeskMoved', deskId: 1, x: 10, y: 6, xpSpent: 0 }]);
  });

  const refused: { name: string; to: { x: number; y: number } }[] = [
    { name: 'a path tile', to: { x: 8, y: 1 } },
    { name: 'a tile off the board', to: { x: 20, y: 0 } },
    { name: 'another desk tile', to: { x: 6, y: 0 } },
    { name: 'the tile it already occupies', to: { x: 4, y: 0 } },
  ];

  it.each(refused)('is rejected onto $name and changes nothing', ({ to }) => {
    const funded = at(placed(), { xp: 37 });
    // `at` collapses to one desk; re-add the neighbour so the occupied case has something to hit
    const run = { ...funded, desks: [funded.desks[0], placed().desks[1]] };
    const quiet = tick(run, []);
    const noisy = tick(run, [{ type: 'MoveDesk', deskId: 1, x: to.x, y: to.y }]);

    expect(noisy.run).toEqual(quiet.run); // no XP charged for a move that did not happen
    expect(noisy.events).toEqual(quiet.events);
  });
});

describe('RemoveDesk', () => {
  it('destroys the person: the slot returns, the XP and levels do not', () => {
    const placed = tick(createRun(runConfig(board(), [wave(1)]), 1), [{ type: 'PlaceDesk', x: 4, y: 0 }]).run;
    const senior = tick(grant(placed, 100), [
      { type: 'BuyLevel', deskId: 1, path: 'craft' },
      { type: 'BuyLevel', deskId: 1, path: 'craft' },
    ]).run;
    expect(senior.desks[0]).toMatchObject({ craft: 2, xp: 100 - TABLE.craft[0].price - TABLE.craft[1].price });

    const gone = tick(senior, [{ type: 'RemoveDesk', deskId: 1 }]);
    expect(gone.run.desks).toEqual([]);
    expect(gone.events).toEqual([{ type: 'DeskRemoved', deskId: 1, xpLost: senior.desks[0].xp }]);

    const rehired = tick(gone.run, [{ type: 'PlaceDesk', x: 4, y: 0 }]).run;
    expect(rehired.desks).toHaveLength(1);
    expect(rehired.desks[0]).toMatchObject({ craft: 0, process: 0, xp: 0 });
    expect(rehired.desks[0].id).not.toBe(1);
    expect(JSON.stringify(rehired.desks)).not.toContain('"craft":2');
    expect(snapshot(rehired).desksPlaced).toBe(1);
    expect(snapshot(rehired).deskBudget).toBe(placed.deskBudget);
  });
});

describe('spending while a wave runs', () => {
  it('ignores BuyLevel and MoveDesk mid-wave and accepts both in the build phase', () => {
    const config = runConfig(board(), [wave(3, { bug: bugStats({ hp: 10_000, speed: 1 }) })]);
    const placed = tick(createRun(config, 4), [{ type: 'PlaceDesk', x: 9, y: 3 }]).run;
    const funded = at(placed, { xp: 100 });
    const spend: Command[] = [
      { type: 'BuyLevel', deskId: 1, path: 'craft' },
      { type: 'MoveDesk', deskId: 1, x: 12, y: 6 },
    ];

    // the same batch is accepted in the build phase — otherwise this proves only that the
    // commands are inert everywhere
    const inBuild = tick(funded, spend);
    expect(inBuild.run.desks[0]).toMatchObject({ craft: 1, x: 12, y: 6 });

    const running = tick(funded, [{ type: 'StartSprint' }]).run;
    expect(running.phase).toBe('running');
    const quiet = tick(running, []);
    const noisy = tick(running, spend);

    expect(noisy.run).toEqual(quiet.run);
    expect(noisy.events).toEqual(quiet.events);
  });
});

describe('the snapshot cap fields', () => {
  const cap = TABLE.crossPathCap;
  const top = TABLE.craft.length;
  const paths = ['craft', 'process'] as const;
  const base = () =>
    tick(createRun(runConfig(board(), [wave(1)]), 1), [{ type: 'PlaceDesk', x: 4, y: 0 }]).run;

  it('offers a price exactly where a purchase is accepted, at every reachable level pair', () => {
    let offered = 0;
    let withheld = 0;

    for (let craft = 0; craft <= top; craft += 1) {
      for (let process = 0; process <= top; process += 1) {
        if (Math.min(craft, process) > cap) continue; // unreachable by T7
        const run = at(base(), { craft, process, xp: 100_000 });
        const snap = snapshot(run).desks[0];

        expect(snap).toMatchObject({ craft, process, title: titleOf(run.desks[0], TABLE) });

        for (const path of paths) {
          const price = snap.nextPrice[path];
          const noisy = tick(run, [{ type: 'BuyLevel', deskId: 1, path }]);

          if (price === null) {
            withheld += 1;
            const quiet = tick(run, []);
            expect(noisy.run, `${craft},${process} ${path}`).toEqual(quiet.run);
            expect(noisy.events).toEqual(quiet.events);
          } else {
            offered += 1;
            expect(noisy.run.desks[0][path], `${craft},${process} ${path}`).toBe(run.desks[0][path] + 1);
            expect(noisy.run.desks[0].xp).toBe(run.desks[0].xp - price);
          }
        }

        // lockedPath is the cap's doing, not the ladder's top: a maxed path is withheld but
        // not locked.
        const locked = paths.find((p) => snap.nextPrice[p] === null && run.desks[0][p] < top) ?? null;
        expect(snap.lockedPath, `${craft},${process}`).toBe(locked);
      }
    }

    expect(offered).toBeGreaterThan(0); // the loop proves nothing if it never sees both answers
    expect(withheld).toBeGreaterThan(0);

    // and the cap is what withheld them, at the exact boundary the design names
    expect(snapshot(at(base(), { craft: 2, process: 2 })).desks[0].nextPrice)
      .toEqual({ craft: TABLE.craft[2].price, process: TABLE.process[2].price });
    expect(snapshot(at(base(), { craft: 3, process: 2 })).desks[0])
      .toMatchObject({ lockedPath: 'process', nextPrice: { craft: TABLE.craft[3].price, process: null } });
  });
});
