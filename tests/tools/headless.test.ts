import { describe, expect, it } from 'vitest';
import { runHeadless } from '../../tools/headless';
import { NAMED_LAYOUTS } from '../../tools/layouts';
import { TICK_RATE } from '../../src/sim/sim';
import { DEFAULT_RUN_CONFIG } from '../../src/content/run';

const SPREAD = NAMED_LAYOUTS[0].tiles;

describe('a headless run', () => {
  it('replays the same config and seed into a byte-identical event stream', () => {
    const first = runHeadless(DEFAULT_RUN_CONFIG, 1234, SPREAD);
    const second = runHeadless(DEFAULT_RUN_CONFIG, 1234, SPREAD);
    const other = runHeadless(DEFAULT_RUN_CONFIG, 4321, SPREAD);

    expect(['victory', 'defeat']).toContain(first.outcome);
    expect(first.eventCount).toBeGreaterThan(50);
    expect(second.eventHash).toBe(first.eventHash);
    expect(second).toEqual(first); // the metrics too, not only the hash
    // the seed is load-bearing, not decoration
    expect(other.eventHash).not.toBe(first.eventHash);
  });

  it('accounts for every tick and every point of uptime in its per-wave metrics', () => {
    const outcome = runHeadless(DEFAULT_RUN_CONFIG, 7, SPREAD);

    expect(outcome.desksPlaced).toBe(SPREAD.length);
    expect(outcome.waves.map((w) => w.wave)).toEqual(
      Array.from({ length: outcome.waves.length }, (_, i) => i + 1),
    );
    expect(outcome.waves).toHaveLength(
      outcome.outcome === 'victory' ? DEFAULT_RUN_CONFIG.waves.length : outcome.wavesCleared + 1,
    );
    for (const w of outcome.waves) {
      expect(w.ticks).toBeGreaterThan(0);
      expect(w.seconds).toBeCloseTo(w.ticks / TICK_RATE, 10);
      expect(w.killsPerDesk).toBeCloseTo(w.kills / outcome.desksPlaced, 10);
    }

    const ticks = outcome.waves.reduce((sum, w) => sum + w.ticks, 0);
    const lost = outcome.waves.reduce((sum, w) => sum + w.uptimeLost, 0);
    expect(ticks).toBe(outcome.ticks);
    expect(outcome.uptimeRemaining).toBe(DEFAULT_RUN_CONFIG.rules.startingUptime - lost);
    expect(outcome.waves[outcome.waves.length - 1].uptimeRemaining).toBe(outcome.uptimeRemaining);
  });

  it('replays a run that spends XP into a byte-identical event stream', () => {
    const first = runHeadless(DEFAULT_RUN_CONFIG, 1234, SPREAD, 'craft');
    const second = runHeadless(DEFAULT_RUN_CONFIG, 1234, SPREAD, 'craft');
    const process = runHeadless(DEFAULT_RUN_CONFIG, 1234, SPREAD, 'process');
    const idle = runHeadless(DEFAULT_RUN_CONFIG, 1234, SPREAD, 'none');

    expect(second.eventHash).toBe(first.eventHash);
    expect(second).toEqual(first);
    // progression is actually active: the same config and seed diverge on how the XP was spent
    expect(first.eventHash).not.toBe(idle.eventHash);
    expect(process.eventHash).not.toBe(first.eventHash);
  });
});
