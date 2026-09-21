import type { RunConfig, RunRules } from '../sim/sim';
import { MILESTONE_1_BOARD } from './board';
import { MILESTONE_1_WAVES } from './waves';
import { DEVELOPER } from './roles';

export const MILESTONE_1_RUN: RunRules = {
  startingUptime: 20,
  deskBudget: 3,
  defaultRole: DEVELOPER.role,
};

export const DEFAULT_RUN_CONFIG: RunConfig = {
  board: MILESTONE_1_BOARD,
  waves: MILESTONE_1_WAVES,
  rules: MILESTONE_1_RUN,
  roles: { [DEVELOPER.role]: DEVELOPER },
};
