import type { Desk, DeskStats, EntityId } from './entities';

export type Path = 'craft' | 'process';

export type CraftLevel   = { price: number; damage: number; range: number; cooldownTicks: number };
export type ProcessLevel = { price: number; ownDamageMultiplier: number; auraRadius: number; auraMultiplier: number };

export type ProgressionTable = {
  /** index 0 describes level 1; `craft.length` is the top level on both paths */
  craft: CraftLevel[];
  process: ProcessLevel[];
  crossPathCap: number;
  moveCostFraction: number;
  assistFraction: number;
  titles: { craft: string[]; process: string[] };
};

export type Aura = { deskId: EntityId; radius: number; multiplier: number };

const other = (path: Path): Path => (path === 'craft' ? 'process' : 'craft');

/** The price of *reaching* `level` on `path`, or null when no such level exists. */
export function priceOf(path: Path, level: number, table: ProgressionTable): number | null {
  const ladder = table[path];
  return level >= 1 && level <= ladder.length ? ladder[level - 1].price : null;
}

/** The single statement of the cap: a purchase is legal when the resulting level is at or below
 *  `crossPathCap`, or when the other path is at or below it. Affordability is not consulted —
 *  a price you are saving toward is still a price. */
function capAllows(desk: Desk, path: Path, table: ProgressionTable): boolean {
  return desk[path] + 1 <= table.crossPathCap || desk[other(path)] <= table.crossPathCap;
}

/** What this desk's next level on `path` costs, or null when the ladder or the cap forbids it.
 *  This is the only producer of `SnapshotDesk.nextPrice`. */
export function nextPriceFor(desk: Desk, path: Path, table: ProgressionTable): number | null {
  if (!capAllows(desk, path, table)) return null;
  return priceOf(path, desk[path] + 1, table);
}

/** The path the cap has closed, or null. At most one can ever be closed: closing both would need
 *  both paths above the cap, which the rule itself makes unreachable. */
export function lockedPathOf(desk: Desk, table: ProgressionTable): Path | null {
  if (!capAllows(desk, 'craft', table)) return 'craft';
  if (!capAllows(desk, 'process', table)) return 'process';
  return null;
}

export function canBuy(desk: Desk, path: Path, table: ProgressionTable): boolean {
  const price = nextPriceFor(desk, path, table);
  return price !== null && desk.xp >= price;
}

/** The deeper path's name, craft on a tie; a blank hire has no title. */
export function titleOf(desk: Desk, table: ProgressionTable): string {
  if (desk.craft === 0 && desk.process === 0) return '';
  return desk.craft >= desk.process
    ? table.titles.craft[desk.craft - 1]
    : table.titles.process[desk.process - 1];
}

/** This desk's own aura, or null at process level 0. */
export function auraOf(desk: Desk, table: ProgressionTable): Aura | null {
  if (desk.process === 0) return null;
  const level = table.process[desk.process - 1];
  return { deskId: desk.id, radius: level.auraRadius, multiplier: level.auraMultiplier };
}

/** The strongest single aura reaching `desk` from *another* desk. Auras never stack: the winner
 *  is applied whole. Equal multipliers resolve to the lower entity id so the choice — and the
 *  assist XP that follows it — is deterministic. A desk is never buffed by its own aura. */
export function bestAura(desk: Desk, desks: readonly Desk[], table: ProgressionTable): Aura | null {
  let best: Aura | null = null;
  for (const source of desks) {
    if (source.id === desk.id) continue;
    const aura = auraOf(source, table);
    if (aura === null) continue;
    if (Math.hypot(source.x - desk.x, source.y - desk.y) > aura.radius) continue;
    if (best === null || aura.multiplier > best.multiplier ||
        (aura.multiplier === best.multiplier && aura.deskId < best.deskId)) {
      best = aura;
    }
  }
  return best;
}

/** Craft owns what a desk *is*; process owns what happens to it. Range and fire rate come from
 *  craft alone. Never stored on the desk — the snapshot would then lie about who the person is,
 *  and the result would depend on desk iteration order. */
export function statsWithAura(desk: Desk, aura: Aura | null, table: ProgressionTable): DeskStats {
  const base = desk.craft === 0
    ? { damage: desk.damage, range: desk.range, cooldownTicks: desk.cooldownTicks }
    : table.craft[desk.craft - 1];
  const own = desk.process === 0 ? 1 : table.process[desk.process - 1].ownDamageMultiplier;
  return {
    role: desk.role,
    damage: base.damage * own * (aura === null ? 1 : aura.multiplier),
    range: base.range,
    cooldownTicks: base.cooldownTicks,
  };
}

export function effectiveStats(desk: Desk, desks: readonly Desk[], table: ProgressionTable): DeskStats {
  return statsWithAura(desk, bestAura(desk, desks, table), table);
}
