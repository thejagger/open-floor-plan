import { pointAtDistance } from './board';
import type { EntityId } from './entities';
import { auraOf, bestAura, lockedPathOf, nextPriceFor, statsWithAura, titleOf } from './progression';
import type { Path } from './progression';
import type { Phase, RunState } from './sim';

export type SnapshotBug  = { id: EntityId; type: string; x: number; y: number; hp: number; maxHp: number };
export type SnapshotDesk = {
  id: EntityId;
  role: string;
  x: number;
  y: number;
  cooldownRemaining: number;
  xp: number;
  craft: number;
  process: number;
  title: string;
  auraRadius: number;  // 0 at process level 0
  damage: number;      // effective, this tick
  range: number;       // effective: craft's alone
  lockedPath: Path | null;
  nextPrice: { craft: number | null; process: number | null };
};

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
    desks: run.desks.map((desk) => {
      const table = run.progression;
      const stats = statsWithAura(desk, bestAura(desk, run.desks, table), table);
      const own = auraOf(desk, table);
      return {
        id: desk.id,
        role: desk.role,
        x: desk.x,
        y: desk.y,
        cooldownRemaining: desk.cooldownRemaining,
        xp: desk.xp,
        craft: desk.craft,
        process: desk.process,
        title: titleOf(desk, table),
        auraRadius: own === null ? 0 : own.radius,
        damage: stats.damage,
        range: stats.range,
        lockedPath: lockedPathOf(desk, table),
        nextPrice: {
          craft: nextPriceFor(desk, 'craft', table),
          process: nextPriceFor(desk, 'process', table),
        },
      };
    }),
  };
}
