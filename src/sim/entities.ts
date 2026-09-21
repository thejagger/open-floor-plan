import type { Tile } from './board';

export type EntityId = number;

export type BugStats = { type: string; hp: number; speed: number; leakCost: number; xp: number };
export type DeskStats = { role: string; damage: number; range: number; cooldownTicks: number };

export type Bug = {
  id: EntityId;
  type: string;
  hp: number;
  maxHp: number;
  speed: number; // tiles per second
  leakCost: number;
  xp: number;    // earned by whoever lands the kill
  distance: number; // tile units along the path
};

export type Desk = {
  id: EntityId;
  role: string;
  x: number;
  y: number;
  /** Base stats from the role table. Craft levels replace them; the buffed values are never
   *  stored — see `effectiveStats`. */
  damage: number;
  range: number;
  cooldownTicks: number;
  cooldownRemaining: number;
  xp: number;      // unspent
  craft: number;   // 0..table.craft.length
  process: number; // 0..table.process.length
};

export function createBug(id: EntityId, stats: BugStats): Bug {
  return {
    id,
    type: stats.type,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    leakCost: stats.leakCost,
    xp: stats.xp,
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
    xp: 0,
    craft: 0,
    process: 0,
  };
}
