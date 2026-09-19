import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/game/engine';
import { MAX_CATCHUP_TICKS } from '../../src/game/stepper';

/** Ticks advanced by `frames` frames of `frameMs` each, at a given time scale. */
function ticksAfter(timeScale: number, frames: number, frameMs: number): number {
  const engine = createEngine(1234);
  engine.timeScale = timeScale;
  for (let i = 0; i < frames; i += 1) engine.advance(frameMs);
  return engine.current.tick;
}

describe('timeScale', () => {
  it('fast-forwards by the scale it was given, even at a low frame rate', () => {
    // 10 frames of 100ms is 1s of real time: 20 ticks at scale 1, 400 at scale 20.
    // Red before the fix: the catch-up cap is applied to *scaled* time, so scale 20 is
    // silently throttled to MAX_CATCHUP_TICKS per frame — 50 ticks, 8x short.
    expect(ticksAfter(1, 10, 100)).toBe(20);
    expect(ticksAfter(20, 10, 100)).toBe(400);
  });

  it('still discards a hidden tab\'s backlog, measured in real time', () => {
    // The scale-1 case is stepper.test.ts's own guard (one frame carrying 10s of real time
    // may not simulate a whole wave), restated through createEngine+sim — it can't go red
    // here without stepper.test.ts going red first, so it isn't repeated. What's new at this
    // level: the same 10s of *real* time is still bounded at scale 20, now by the real-time
    // budget rather than a flat tick count.
    expect(ticksAfter(20, 1, 10_000)).toBe(MAX_CATCHUP_TICKS * 20);
  });
});
