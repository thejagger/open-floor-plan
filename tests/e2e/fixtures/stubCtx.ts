import { createRun, snapshot } from '../../../src/sim';
import { MILESTONE_1_BOARD } from '../../../src/content/board';
import { MILESTONE_1_WAVES } from '../../../src/content/waves';
import type { Engine } from '../../../src/game/engine';
import type { GameCtx } from '../../../src/game/GameContext';
import { createVfxBus } from '../../../src/render/vfx/bus';

export function stubCtx(bugCount: number): GameCtx {
  const base = snapshot(createRun(MILESTONE_1_BOARD, MILESTONE_1_WAVES, 1));
  const bugs = Array.from({ length: bugCount }, (_, i) => ({
    id: i + 1, type: 'typo', hp: 2, maxHp: 2,
    x: 1 + (i % 10), y: 1 + Math.floor(i / 10),
  }));
  const snap = { ...base, bugs };
  const engine: Engine = {
    seed: 1, previous: snap, current: snap, previousById: new Map(), lastSeen: new Map(),
    alpha: 0, events: [], timeScale: 0, submit() {}, advance() {},
  };
  return { engine, bus: createVfxBus(), restart() {} };
}
