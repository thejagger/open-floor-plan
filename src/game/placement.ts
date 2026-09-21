import { inBounds, placementError } from '../sim';
import type { BoardDef, Command, EntityId, Snapshot, SnapshotDesk, Tile } from '../sim';

export type TileStatus = 'placeable' | 'moveTarget' | 'desk' | 'blocked';

/** Board-plane point -> tile. One world unit per tile; tile (x,y) is centred at world (x,0,y). */
export function tileAtPoint(board: BoardDef, worldX: number, worldZ: number): Tile | null {
  // `+ 0` normalises -0 (Math.round(-0.2) etc.) to 0 so a click at the board's near edge reads
  // as tile 0, not a distinct "-0" that compares unequal to it.
  const tile = { x: Math.round(worldX) + 0, y: Math.round(worldZ) + 0 };
  return inBounds(board, tile.x, tile.y) ? tile : null;
}

export function deskAtTile(snap: Snapshot, tile: Tile): SnapshotDesk | null {
  return snap.desks.find((d) => d.x === tile.x && d.y === tile.y) ?? null;
}

/**
 * Selection changes what a click on the same tile means, so it is an argument here rather than
 * something the caller reconciles afterwards. A selection naming a desk that is no longer on the
 * board falls back to placing: a stale id must not turn every empty tile into a destination for
 * a person who does not exist.
 */
export function tileStatus(
  board: BoardDef,
  snap: Snapshot,
  selection: EntityId | null,
  tile: Tile,
): TileStatus {
  if (snap.phase !== 'build') return 'blocked';
  if (deskAtTile(snap, tile) !== null) return 'desk';
  const occupied = snap.desks.map((d) => ({ x: d.x, y: d.y }));
  if (placementError(board, occupied, tile.x, tile.y) !== null) return 'blocked';
  if (selection !== null && snap.desks.some((d) => d.id === selection)) return 'moveTarget';
  return snap.desksPlaced >= snap.deskBudget ? 'blocked' : 'placeable';
}

/** The command a click on this tile should send, or null when the click sends nothing. Selecting
 *  a desk is not a command — the sim never hears about it — so 'desk' yields null here and
 *  `Ground` handles the selection itself. */
export function commandForTile(
  board: BoardDef,
  snap: Snapshot,
  selection: EntityId | null,
  tile: Tile,
): Command | null {
  switch (tileStatus(board, snap, selection, tile)) {
    case 'placeable':
      return { type: 'PlaceDesk', x: tile.x, y: tile.y };
    case 'moveTarget':
      return { type: 'MoveDesk', deskId: selection as EntityId, x: tile.x, y: tile.y };
    default:
      return null;
  }
}
