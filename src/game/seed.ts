/** A fresh seed for a restart, guaranteed different from the run just finished. */
export function nextSeed(previous: number): number {
  let seed = previous;
  while (seed === previous) seed = (Math.random() * 0x1_0000_0000) >>> 0;
  return seed;
}
