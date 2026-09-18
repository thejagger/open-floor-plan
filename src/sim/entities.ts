import type { Tile } from './board';

export type EntityId = number;

export type BugStats = { type: string; hp: number; speed: number; leakCost: number };
export type DeskStats = { role: string; damage: number; range: number; cooldownTicks: number };

export type Bug = {
  id: EntityId;
  type: string;
  hp: number;
  maxHp: number;
  speed: number; // tiles per second
  leakCost: number;
  distance: number; // tile units along the path
};

export type Desk = {
  id: EntityId;
  role: string;
  x: number;
  y: number;
  damage: number;
  range: number;
  cooldownTicks: number;
  cooldownRemaining: number;
};

export function createBug(id: EntityId, stats: BugStats): Bug {
  return {
    id,
    type: stats.type,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    leakCost: stats.leakCost,
    distance: 0,
  };
}

export function createDesk(id: EntityId, tile: Tile, stats: DeskStats): Desk {
  return {
    id,
    role: stats.role,
    x: tile.x,
    y: tile.y,
    damage: stats.damage,
    range: stats.range,
    cooldownTicks: stats.cooldownTicks,
    cooldownRemaining: 0,
  };
}
