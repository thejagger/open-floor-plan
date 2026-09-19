import { TICK_RATE } from '../sim';

export const TICK_MS = 1000 / TICK_RATE; // 50
export const MAX_CATCHUP_TICKS = 5;

export type StepResult = { steps: number; accumulatorMs: number };

/**
 * Fixed-step accumulator. Time owed beyond the catch-up cap is discarded rather than carried,
 * so a tab that was hidden for a minute does not simulate a whole wave on the frame it comes
 * back and then spiral trying to catch up.
 *
 * `maxCatchupTicks` is a budget in *real* time, not in simulated ticks: a caller running the
 * sim at N times speed passes N times the cap, so the guard still admits the same quarter
 * second of wall clock while the fast-forward it was never meant to limit gets through.
 */
export function stepsFor(
  accumulatorMs: number,
  elapsedMs: number,
  maxCatchupTicks: number = MAX_CATCHUP_TICKS,
): StepResult {
  // Floor alone would zero the budget for any timeScale below 0.2 (5 * 0.2 floors to 1, but
  // anything less floors to 0), freezing the sim outright instead of slowing it down.
  const cap = Math.max(1, Math.floor(maxCatchupTicks));
  const total = accumulatorMs + Math.max(0, elapsedMs);
  const wanted = Math.floor(total / TICK_MS);
  const steps = Math.min(wanted, cap);
  return { steps, accumulatorMs: wanted > cap ? 0 : total - steps * TICK_MS };
}
