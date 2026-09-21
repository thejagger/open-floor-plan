import { describe, expect, it } from 'vitest';
import { createRun, tick } from '../../src/sim/sim';
import { allEvents, bugStats, record, runConfig, straightBoard, wave } from '../helpers/sim';

describe('a bug that reaches Production', () => {
  it('emits BugLeaked and UptimeLost and costs exactly its leak cost', () => {
    const run0 = createRun(
      runConfig(straightBoard(4), [wave(1, { bug: bugStats({ hp: 1, speed: 3, leakCost: 3 }) }), wave(1)]),
      11,
    );
    const startingUptime = run0.uptime;

    const started = tick(run0, [{ type: 'StartSprint' }]).run;
    const { run, frames } = record(started, (r) => r.phase !== 'running');
    const events = allEvents(frames);

    const leakedAt = events.findIndex((e) => e.type === 'BugLeaked');
    expect(leakedAt).toBeGreaterThanOrEqual(0);
    expect(events[leakedAt]).toMatchObject({ type: 'BugLeaked', leakCost: 3 });
    expect(events[leakedAt + 1]).toMatchObject({
      type: 'UptimeLost',
      amount: 3,
      uptime: startingUptime - 3,
    });
    expect(run.uptime).toBe(startingUptime - 3);
  });
});

describe('a wave', () => {
  it('ends only once every spawned bug has resolved, then returns to build', () => {
    // pathLength 2 at 2 tiles/sec is a 20-tick crossing; spawns 60 ticks apart, so the
    // board stands empty between bugs and an "any bugs left?" wave-end check would fire early.
    const swarm = wave(3, {
      bug: bugStats({ hp: 1, speed: 2, leakCost: 0 }),
      spawnIntervalTicks: 60,
    });
    const run0 = createRun(runConfig(straightBoard(3), [swarm, swarm]), 2);
    // The wave advances in the same tick as StartSprint, so the first bug can spawn
    // immediately — capture that tick's events too, not just the ones `record` sees after.
    const first = tick(run0, [{ type: 'StartSprint' }]);

    const { run, frames } = record(first.run, (r) => r.phase !== 'running');
    const events = [...first.events, ...allEvents(frames)];
    const endedAt = frames.findIndex((f) => f.events.some((e) => e.type === 'WaveEnded'));

    expect(events.filter((e) => e.type === 'BugSpawned')).toHaveLength(3);
    expect(events.filter((e) => e.type === 'BugLeaked')).toHaveLength(3);
    expect(endedAt).toBeGreaterThanOrEqual(0);
    expect(frames.slice(0, endedAt).every((f) => f.snapshot.phase === 'running')).toBe(true);
    expect(frames.slice(0, endedAt).some((f) => f.snapshot.bugs.length === 0)).toBe(true);
    expect(frames[endedAt].events.filter((e) => e.type === 'BugLeaked')).toHaveLength(1);
    expect(frames[endedAt].events.find((e) => e.type === 'WaveEnded')).toMatchObject({ wave: 1 });
    expect(run.phase).toBe('build');
    expect(run.currentWave).toBe(1);
  });
});
