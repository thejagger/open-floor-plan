import type { CraftLevel, ProcessLevel, ProgressionTable } from '../sim/progression';

/** Declared in `sim/` because `src/sim` may not import `../content` (eslint, and
 *  `tests/boundary.test.ts`); re-exported here because `content/progression.ts` is the path
 *  importers use, and the table itself lives here so the harness sweeps it without touching sim. */
export type { CraftLevel, Path, ProcessLevel, ProgressionTable } from '../sim/progression';

/** Placeholder curve — priced against the balance harness once wave and run length settle. */
const CRAFT: CraftLevel[] = [
  { price: 10,  damage: 2,  range: 2.5, cooldownTicks: 10 },
  { price: 25,  damage: 3,  range: 3.0, cooldownTicks: 9 },
  { price: 50,  damage: 5,  range: 3.5, cooldownTicks: 8 },
  { price: 90,  damage: 8,  range: 4.0, cooldownTicks: 7 },
  { price: 150, damage: 12, range: 4.5, cooldownTicks: 6 },
];

const PROCESS: ProcessLevel[] = [
  { price: 10,  ownDamageMultiplier: 1.0, auraRadius: 2.0, auraMultiplier: 1.1 },
  { price: 25,  ownDamageMultiplier: 0.9, auraRadius: 2.5, auraMultiplier: 1.25 },
  { price: 50,  ownDamageMultiplier: 0.8, auraRadius: 3.0, auraMultiplier: 1.45 },
  { price: 90,  ownDamageMultiplier: 0.6, auraRadius: 3.5, auraMultiplier: 1.7 },
  { price: 150, ownDamageMultiplier: 0.4, auraRadius: 4.0, auraMultiplier: 2.0 },
];

export const MILESTONE_2_PROGRESSION: ProgressionTable = {
  craft: CRAFT,
  process: PROCESS,
  crossPathCap: 2,
  moveCostFraction: 0.25,
  assistFraction: 0.5,
  titles: {
    craft: ['junior', 'mid', 'senior', 'staff', 'principal'],
    process: ['junior', 'reviewer', 'mentor', 'tech lead', 'PM'],
  },
};
