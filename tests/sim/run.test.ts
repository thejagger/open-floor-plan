import { describe, expect, it, vi } from 'vitest';
import { createRun, tick } from '../../src/sim/sim';
import { snapshot } from '../../src/sim/snapshot';
import { MILESTONE_1_BOARD } from '../../src/content/board';
import { MILESTONE_1_WAVES } from '../../src/content/waves';
import { MILESTONE_1_RUN } from '../../src/content/run';
import { DEVELOPER } from '../../src/content/roles';
import { advance, allEvents, autoSprint, bugStats, record, straightBoard, terminal, wave } from '../helpers/sim';
import type { Command } from '../../src/sim/commands';
import type { RunState } from '../../src/sim/sim';

const LAYOUT: Command[] = [
  { type: 'PlaceDesk', x: 3, y: 0 },
  { type: 'PlaceDesk', x: 7, y: 2 },
  { type: 'PlaceDesk', x: 8, y: 4 },
];

const scripted = (r: RunState): Command[] =>
  r.phase !== 'build' ? [] : [...(r.desks.length === 0 ? LAYOUT : []), { type: 'StartSprint' }];

function play(seed: number) {
  const { run, frames } = record(
    createRun(MILESTONE_1_BOARD, MILESTONE_1_WAVES, seed),
    terminal,
    scripted,
  );
  return { run, frames, events: allEvents(frames) };
}

describe('determinism', () => {
  it('replays the same board, seed and commands into an identical event stream', () => {
    const first = play(1234);
    const second = play(1234);
    const other = play(4321);

    expect(first.run.phase === 'victory' || first.run.phase === 'defeat').toBe(true);
    expect(first.events.length).toBeGreaterThan(50);
    expect(second.events).toEqual(first.events);
    expect(snapshot(second.run)).toEqual(snapshot(first.run));
    // the seed is load-bearing, not decoration
    expect(other.events).not.toEqual(first.events);
  });

  it('advances by N ticks identically however much wall-clock time passes between calls', async () => {
    const start = createRun(MILESTONE_1_BOARD, MILESTONE_1_WAVES, 99);
    const oneGo = advance(start, 400, [{ type: 'StartSprint' }]);

    vi.useFakeTimers();
    try {
      let current = tick(start, [{ type: 'StartSprint' }]);
      const events = [...current.events];
      for (let i = 1; i < 137; i += 1) {
        current = tick(current.run, []);
        events.push(...current.events);
      }
      vi.setSystemTime(new Date('2031-06-01T00:00:00Z'));
      await vi.advanceTimersByTimeAsync(3_600_000);
      for (let i = 137; i < 400; i += 1) {
        current = tick(current.run, []);
        events.push(...current.events);
      }

      expect(current.run).toEqual(oneGo.run);
      expect(events).toEqual(oneGo.events);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('uptime', () => {
  it('never increases at any point in a run', () => {
    const { frames } = record(
      createRun(MILESTONE_1_BOARD, MILESTONE_1_WAVES, 21),
      terminal,
      autoSprint, // no desks: every Typo leaks
    );
    const uptimes = frames.map((f) => f.snapshot.uptime);
    const rises = uptimes
      .map((u, i) => ({ tick: frames[i].tick, from: uptimes[i - 1], to: u }))
      .filter((step, i) => i > 0 && step.to > step.from);

    expect(uptimes[0]).toBeLessThanOrEqual(MILESTONE_1_RUN.startingUptime);
    expect(rises).toEqual([]);
    expect(uptimes[uptimes.length - 1]).toBeLessThan(MILESTONE_1_RUN.startingUptime);
  });
});

describe('the end of a run', () => {
  it('enters defeat at uptime 0, reports it once, and starts no further wave', () => {
    const fatal = bugStats({ hp: 1, speed: 2, leakCost: MILESTONE_1_RUN.startingUptime });
    const ladder = [wave(2, { bug: fatal }), wave(1), wave(1), wave(1), wave(1)];
    const started = tick(createRun(straightBoard(6), ladder, 8), [{ type: 'StartSprint' }]).run;

    const { run, frames } = record(started, terminal);
    const events = allEvents(frames);
    const over = events.filter((e) => e.type === 'RunOver');

    expect(run.phase).toBe('defeat');
    expect(run.uptime).toBe(0);
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ type: 'RunOver', outcome: 'defeat', uptime: 0 });
    expect(events.filter((e) => e.type === 'WaveEnded')).toHaveLength(0);

    const refused = tick(run, [{ type: 'StartSprint' }]);
    expect(refused.events).toEqual([]);
    expect(refused.run).toEqual(run);
    const later = advance(run, 100, [{ type: 'StartSprint' }]);
    expect(later.events).toEqual([]);
    expect(later.run.phase).toBe('defeat');
    expect(later.run.currentWave).toBe(run.currentWave);
  });

  it('enters victory after clearing the fifth wave with uptime remaining', () => {
    // the fixture parks one desk a single tile off the path, and one shot must kill
    expect(DEVELOPER.range).toBeGreaterThanOrEqual(1);
    expect(DEVELOPER.damage).toBeGreaterThanOrEqual(1);

    const ladder = Array.from({ length: 5 }, () => wave(1, { bug: bugStats({ hp: 1, speed: 1 }) }));
    const run0 = createRun(straightBoard(12), ladder, 7);
    const { run, frames } = record(run0, terminal, (r) =>
      r.phase !== 'build' ? [] : [...(r.desks.length === 0 ? [{ type: 'PlaceDesk', x: 4, y: 0 } as Command] : []), { type: 'StartSprint' }],
    );
    const events = allEvents(frames);

    expect(run.phase).toBe('victory');
    expect(run.uptime).toBe(MILESTONE_1_RUN.startingUptime);
    expect(events.filter((e) => e.type === 'BugKilled')).toHaveLength(5);
    expect(events.filter((e) => e.type === 'BugLeaked')).toHaveLength(0);
    expect(events.filter((e) => e.type === 'WaveEnded').map((e) => (e as { wave: number }).wave))
      .toEqual([1, 2, 3, 4, 5]);
    expect(events[events.length - 2]).toMatchObject({ type: 'WaveEnded', wave: 5 });
    expect(events[events.length - 1]).toMatchObject({ type: 'RunOver', outcome: 'victory' });
  });
});
