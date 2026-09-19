import { describe, expect, it } from 'vitest';
import { MAX_CATCHUP_TICKS, stepsFor, TICK_MS } from '../../src/game/stepper';

describe('the fixed-step accumulator', () => {
  it('yields one tick per tick interval and carries the remainder', () => {
    expect(stepsFor(0, 20)).toEqual({ steps: 0, accumulatorMs: 20 });
    expect(stepsFor(20, 40)).toEqual({ steps: 1, accumulatorMs: 10 });
    expect(stepsFor(0, TICK_MS * 3)).toEqual({ steps: 3, accumulatorMs: 0 });
    expect(stepsFor(0, -5)).toEqual({ steps: 0, accumulatorMs: 0 });
  });

  it('discards the backlog past the catch-up cap so a hidden tab cannot spiral', () => {
    // red here means: come back to a tab left open for ten seconds and 200 ticks run on a
    // single frame — the wave you were watching has already resolved without you.
    expect(stepsFor(0, 10_000)).toEqual({ steps: MAX_CATCHUP_TICKS, accumulatorMs: 0 });
    expect(stepsFor(0, TICK_MS * (MAX_CATCHUP_TICKS + 1)))
      .toEqual({ steps: MAX_CATCHUP_TICKS, accumulatorMs: 0 });
  });
});
