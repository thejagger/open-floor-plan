export type RngState = number;

export function createRng(seed: number): RngState {
  return seed | 0;
}

export function nextUint32(state: RngState): { state: RngState; value: number } {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { state: s, value: (t ^ (t >>> 14)) >>> 0 };
}

export function nextFloat(state: RngState): { state: RngState; value: number } {
  const { state: nextState, value } = nextUint32(state);
  return { state: nextState, value: value / 4294967296 };
}

export function nextInt(state: RngState, maxExclusive: number): { state: RngState; value: number } {
  if (maxExclusive <= 0) return { state, value: 0 };
  const { state: nextState, value } = nextFloat(state);
  return { state: nextState, value: Math.floor(value * maxExclusive) };
}
