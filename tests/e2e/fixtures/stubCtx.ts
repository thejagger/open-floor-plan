import { createRun, snapshot } from '../../../src/sim';
import { DEFAULT_RUN_CONFIG } from '../../../src/content/run';
import type { Engine } from '../../../src/game/engine';
import type { GameCtx } from '../../../src/game/GameContext';
import { createVfxBus } from '../../../src/render/vfx/bus';

export function stubCtx(bugCount: number): GameCtx {
  const base = snapshot(createRun(DEFAULT_RUN_CONFIG, 1));
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
