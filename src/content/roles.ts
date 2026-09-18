import type { DeskStats } from '../sim/entities';

/** Placeholder combat values — replaced by Milestone 2's balance harness. */
export const DEVELOPER: DeskStats = { role: 'developer', damage: 1, range: 2.5, cooldownTicks: 10 };
export const ROLES = { developer: DEVELOPER } as const;
