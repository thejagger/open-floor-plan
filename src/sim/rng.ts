export type RngState = number;

export function createRng(seed: number): RngState {
  return seed | 0;
}

/** maxExclusive must be > 0 — the sole caller (waves.ts) always passes spawnJitterTicks + 1. */
export function nextInt(state: RngState, maxExclusive: number): { state: RngState; value: number } {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const uint32 = (t ^ (t >>> 14)) >>> 0;
  const float = uint32 / 4294967296;
  return { state: s, value: Math.floor(float * maxExclusive) };
}
