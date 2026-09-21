import type { Bug } from './entities';

export type Positioned = { bug: Bug; x: number; y: number };
export type Origin = { x: number; y: number; range: number };

/** Euclidean distance in tile units from the origin's tile centre. */
export function inRange(origin: Origin, x: number, y: number): boolean {
  return Math.hypot(x - origin.x, y - origin.y) <= origin.range;
}

/** The in-range bug furthest along the path; ties resolve to the lowest entity id. */
export function selectTarget(origin: Origin, candidates: readonly Positioned[]): Bug | null {
  let best: Positioned | null = null;
  for (const candidate of candidates) {
    if (!inRange(origin, candidate.x, candidate.y)) continue;
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
