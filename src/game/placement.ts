import { inBounds, placementError } from '../sim';
import type { BoardDef, Command, Snapshot, Tile } from '../sim';

export type TileStatus = 'placeable' | 'removable' | 'blocked';

/** Board-plane point -> tile. One world unit per tile; tile (x,y) is centred at world (x,0,y). */
export function tileAtPoint(board: BoardDef, worldX: number, worldZ: number): Tile | null {
  // `+ 0` normalises -0 (Math.round(-0.2) etc.) to 0 so a click at the board's near edge reads
  // as tile 0, not a distinct "-0" that compares unequal to it.
  const tile = { x: Math.round(worldX) + 0, y: Math.round(worldZ) + 0 };
  return inBounds(board, tile.x, tile.y) ? tile : null;
}

export function tileStatus(board: BoardDef, snap: Snapshot, tile: Tile): TileStatus {
  if (snap.phase !== 'build') return 'blocked';
  if (snap.desks.some((d) => d.x === tile.x && d.y === tile.y)) return 'removable';
  if (snap.desksPlaced >= snap.deskBudget) return 'blocked';
  const occupied = snap.desks.map((d) => ({ x: d.x, y: d.y }));
  return placementError(board, occupied, tile.x, tile.y) === null ? 'placeable' : 'blocked';
}

/** The command a click on this tile should send, or null when the click does nothing. */
export function commandForTile(board: BoardDef, snap: Snapshot, tile: Tile): Command | null {
  switch (tileStatus(board, snap, tile)) {
    case 'placeable':
      return { type: 'PlaceDesk', x: tile.x, y: tile.y };
    case 'removable': {
      const desk = snap.desks.find((d) => d.x === tile.x && d.y === tile.y)!;
      return { type: 'RemoveDesk', deskId: desk.id };
    }
    default:
      return null;
  }
}
