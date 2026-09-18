import type { BugStats } from './entities';
import type { RngState } from './rng';
import { nextInt } from './rng';

export type WaveDef = {
  bug: BugStats;
  count: number;
  spawnIntervalTicks: number;
  spawnJitterTicks: number;
};

/** Spawn tick offsets within the wave, one per bug, index-aligned to spawn order. */
export function buildSchedule(
  wave: WaveDef,
  rngState: RngState,
): { schedule: number[]; rngState: RngState } {
  let state = rngState;
  const schedule: number[] = [];
  for (let i = 0; i < wave.count; i += 1) {
    const jitter = nextInt(state, wave.spawnJitterTicks + 1);
    state = jitter.state;
    schedule.push(i * wave.spawnIntervalTicks + jitter.value);
  }
  return { schedule, rngState: state };
}
