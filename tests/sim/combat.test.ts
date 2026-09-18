import { describe, expect, it } from 'vitest';
import { createRun, tick } from '../../src/sim/sim';
import { selectTarget } from '../../src/sim/combat';
import { createBug, createDesk } from '../../src/sim/entities';
import { DEVELOPER } from '../../src/content/roles';
import { allEvents, bugStats, record, straightBoard, wave } from '../helpers/sim';
import type { Snapshot } from '../../src/sim/snapshot';

const gap = (s: Snapshot) => Math.hypot(s.bugs[0].x - s.desks[0].x, s.bugs[0].y - s.desks[0].y);

describe('a desk out of range', () => {
  it('never fires and never damages a bug that walks past', () => {
    expect(DEVELOPER.range).toBeLessThan(7); // the fixture parks the desk 7 tiles off the path

    const run0 = createRun(straightBoard(12, 9), [wave(1, { bug: bugStats({ hp: 100 }) })], 3);
    const started = tick(run0, [{ type: 'PlaceDesk', x: 5, y: 8 }, { type: 'StartSprint' }]).run;
    expect(started.desks).toHaveLength(1);

    const { run, frames } = record(started, (r) => r.phase !== 'running');
    const events = allEvents(frames);

    expect(events.filter((e) => e.type === 'DeskFired')).toHaveLength(0);
    expect(events.filter((e) => e.type === 'BugDamaged')).toHaveLength(0);
    expect(events.some((e) => e.type === 'BugLeaked')).toBe(true);
    expect(run.phase).toBe('build');
  });
});

describe('a desk in range', () => {
  it('fires on the first tick the bug is reachable, then once per cooldown', () => {
    const run0 = createRun(
      straightBoard(20),
      [wave(1, { bug: bugStats({ hp: 10_000, speed: 1 }) })],
      5,
    );
    const started = tick(run0, [{ type: 'PlaceDesk', x: 9, y: 0 }, { type: 'StartSprint' }]).run;

    const { frames } = record(started, (r) => r.phase !== 'running');
    const firstFire = frames.findIndex((f) => f.events.some((e) => e.type === 'DeskFired'));
    const fireTicks = frames
      .filter((f) => f.events.some((e) => e.type === 'DeskFired'))
      .map((f) => f.tick);

    expect(firstFire).toBeGreaterThan(0);
    expect(gap(frames[firstFire].snapshot)).toBeLessThanOrEqual(DEVELOPER.range);
    expect(gap(frames[firstFire - 1].snapshot)).toBeGreaterThan(DEVELOPER.range);

    expect(fireTicks.length).toBeGreaterThan(3);
    const gaps = fireTicks.slice(1).map((t, i) => t - fireTicks[i]);
    expect([...new Set(gaps)]).toEqual([DEVELOPER.cooldownTicks]);
  });
});

describe('targeting', () => {
  it('shoots the bug furthest along the path while two are in range', () => {
    const run0 = createRun(
      straightBoard(20),
      [wave(2, { bug: bugStats({ hp: 10_000, speed: 1 }), spawnIntervalTicks: 20 })],
      6,
    );
    const started = tick(run0, [{ type: 'PlaceDesk', x: 9, y: 0 }, { type: 'StartSprint' }]).run;
    const { frames } = record(started, (r) => r.phase !== 'running');

    // "Contested" means both bugs are simultaneously within the desk's range — a fixed
    // 1-tile gap between them (same speed, spawned one interval apart) means there are also
    // frames where the leader has already stepped outside range while the trailing bug is
    // still inside it; those aren't a contest and are excluded by the in-range check below.
    const inRangeOf = (desk: Snapshot['desks'][number], bug: Snapshot['bugs'][number]) =>
      Math.hypot(bug.x - desk.x, bug.y - desk.y) <= desk.range;
    const contested = frames.filter(
      (f) =>
        f.snapshot.bugs.length === 2 &&
        f.snapshot.bugs.every((b) => inRangeOf(f.snapshot.desks[0], b)) &&
        f.events.some((e) => e.type === 'DeskFired'),
    );
    expect(contested.length).toBeGreaterThan(2);

    for (const frame of contested) {
      const fired = frame.events.find((e) => e.type === 'DeskFired');
      const leader = [...frame.snapshot.bugs].sort((a, b) => b.x - a.x)[0];
      expect(fired).toMatchObject({ targetId: leader.id });
    }
  });

  it('resolves equal progress to the lowest entity id', () => {
    const desk = createDesk(1, { x: 4, y: 0 }, DEVELOPER);
    const behind = { ...createBug(7, bugStats()), distance: 4 };
    const level = { ...createBug(4, bugStats()), distance: 4 };

    expect(selectTarget(desk, [
      { bug: behind, x: 4, y: 1 },
      { bug: level, x: 4, y: 1 },
    ])?.id).toBe(4);

    expect(selectTarget(desk, [{ bug: behind, x: 4, y: 40 }])).toBeNull();
  });
});
