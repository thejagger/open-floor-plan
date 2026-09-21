import { describe, expect, it, vi } from 'vitest';
import { createRun, tick } from '../../src/sim/sim';
import { snapshot } from '../../src/sim/snapshot';
import { DEFAULT_RUN_CONFIG, MILESTONE_1_RUN } from '../../src/content/run';
import { DEVELOPER } from '../../src/content/roles';
import { advance, allEvents, autoSprint, bugStats, record, runConfig, straightBoard, terminal, wave } from '../helpers/sim';
import type { Command } from '../../src/sim/commands';
import type { RunConfig, RunState } from '../../src/sim/sim';

const LAYOUT: Command[] = [
  { type: 'PlaceDesk', x: 3, y: 0 },
  { type: 'PlaceDesk', x: 7, y: 2 },
  { type: 'PlaceDesk', x: 8, y: 4 },
];

const scripted = (r: RunState): Command[] =>
  r.phase !== 'build' ? [] : [...(r.desks.length === 0 ? LAYOUT : []), { type: 'StartSprint' }];

function play(seed: number) {
  const { run, frames } = record(
    createRun(DEFAULT_RUN_CONFIG, seed),
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
    const start = createRun(DEFAULT_RUN_CONFIG, 99);
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

describe('a run built from a non-default config', () => {
  it('takes role stats and run rules from the config, not from the content defaults', () => {
    const config: RunConfig = {
      board: straightBoard(12),
      waves: [wave(1, { bug: bugStats({ hp: 5, speed: 1 }) })],
      rules: { startingUptime: 7, deskBudget: 1, defaultRole: 'intern' },
      roles: { intern: { role: 'intern', damage: 5, range: 2.5, cooldownTicks: 10 } },
      progression: DEFAULT_RUN_CONFIG.progression,
    };
    // the content defaults could not produce either half of this run
    expect(DEFAULT_RUN_CONFIG.rules.startingUptime).not.toBe(7);
    expect(DEVELOPER.damage).toBeLessThan(5);

    const run0 = createRun(config, 3);
    expect(run0.uptime).toBe(7);
    expect(run0.maxUptime).toBe(7);
    expect(run0.deskBudget).toBe(1);

    const started = tick(run0, [
      { type: 'PlaceDesk', x: 6, y: 0 },
      { type: 'StartSprint' },
    ]).run;
    expect(started.desks[0]).toMatchObject({ role: 'intern', damage: 5, range: 2.5 });

    const { run, frames } = record(started, (r) => r.phase !== 'running');
    const events = allEvents(frames);
    const damaged = events.filter((e) => e.type === 'BugDamaged');

    expect(damaged).toHaveLength(1); // one shot, not five
    expect(damaged[0]).toMatchObject({ damage: 5, hpRemaining: 0 });
    expect(events.filter((e) => e.type === 'BugKilled')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'BugLeaked')).toHaveLength(0);
    expect(run.uptime).toBe(7);
  });
});

describe('uptime', () => {
  it('never increases at any point in a run', () => {
    const { frames } = record(
      createRun(DEFAULT_RUN_CONFIG, 21),
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
    const started = tick(createRun(runConfig(straightBoard(6), ladder), 8), [{ type: 'StartSprint' }]).run;

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
    const run0 = createRun(runConfig(straightBoard(12), ladder), 7);
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
