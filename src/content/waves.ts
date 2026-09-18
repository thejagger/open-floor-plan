import type { WaveDef } from '../sim/waves';
import { TYPO } from './bugs';

const TYPO_COUNTS = [5, 8, 12, 18, 25];

export const MILESTONE_1_WAVES: WaveDef[] = TYPO_COUNTS.map((count) => ({
  bug: TYPO,
  count,
  spawnIntervalTicks: 12,
  spawnJitterTicks: 4,
}));
