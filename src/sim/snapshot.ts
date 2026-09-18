import { pointAtDistance } from './board';
import type { EntityId } from './entities';
import type { Phase, RunState } from './sim';

export type SnapshotBug  = { id: EntityId; type: string; x: number; y: number; hp: number; maxHp: number };
export type SnapshotDesk = { id: EntityId; role: string; x: number; y: number; range: number; cooldownRemaining: number };

export type Snapshot = {
  tick: number;
  phase: Phase;
  wave: number; // 1-based: running now, or next to start
  waveCount: number;
  uptime: number;
  maxUptime: number;
  desksPlaced: number;
  deskBudget: number;
  bugs: SnapshotBug[];
  desks: SnapshotDesk[];
};

export function snapshot(run: RunState): Snapshot {
  return {
    tick: run.tick,
    phase: run.phase,
    wave: run.currentWave + 1,
    waveCount: run.waves.length,
    uptime: run.uptime,
    maxUptime: run.maxUptime,
    desksPlaced: run.desks.length,
    deskBudget: run.deskBudget,
    bugs: run.bugs.map((bug) => {
      const { x, y } = pointAtDistance(run.board, bug.distance);
      return { id: bug.id, type: bug.type, x, y, hp: bug.hp, maxHp: bug.maxHp };
    }),
    desks: run.desks.map((desk) => ({
      id: desk.id,
      role: desk.role,
      x: desk.x,
      y: desk.y,
      range: desk.range,
      cooldownRemaining: desk.cooldownRemaining,
    })),
  };
}
