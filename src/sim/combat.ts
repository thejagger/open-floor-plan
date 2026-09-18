import type { Bug, Desk } from './entities';

export type Positioned = { bug: Bug; x: number; y: number };

/** Euclidean distance in tile units from the desk's tile centre. */
export function inRange(desk: Desk, x: number, y: number): boolean {
  return Math.hypot(x - desk.x, y - desk.y) <= desk.range;
}

/** The in-range bug furthest along the path; ties resolve to the lowest entity id. */
export function selectTarget(desk: Desk, candidates: readonly Positioned[]): Bug | null {
  let best: Positioned | null = null;
  for (const candidate of candidates) {
    if (!inRange(desk, candidate.x, candidate.y)) continue;
    if (
      best === null ||
      candidate.bug.distance > best.bug.distance ||
      (candidate.bug.distance === best.bug.distance && candidate.bug.id < best.bug.id)
    ) {
      best = candidate;
    }
  }
  return best ? best.bug : null;
}
