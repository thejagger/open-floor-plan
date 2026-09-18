export type Tile = { x: number; y: number };
export type BoardDef = { width: number; height: number; path: Tile[] };
export type PlacementError = 'out-of-bounds' | 'path-tile' | 'occupied';

export function pathLength(board: BoardDef): number {
  return board.path.length - 1;
}

export function entranceTile(board: BoardDef): Tile {
  return board.path[0];
}

export function productionTile(board: BoardDef): Tile {
  return board.path[board.path.length - 1];
}

export function inBounds(board: BoardDef, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) &&
    x >= 0 && x < board.width && y >= 0 && y < board.height;
}

export function isPathTile(board: BoardDef, x: number, y: number): boolean {
  return board.path.some((t) => t.x === x && t.y === y);
}

export function pointAtDistance(board: BoardDef, distance: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(distance, pathLength(board)));
  const i = Math.min(Math.floor(clamped), board.path.length - 2);
  const from = board.path[i];
  const to = board.path[i + 1];
  const frac = clamped - i;
  return { x: from.x + (to.x - from.x) * frac, y: from.y + (to.y - from.y) * frac };
}

export function placementError(
  board: BoardDef,
  occupied: readonly Tile[],
  x: number,
  y: number,
): PlacementError | null {
  if (!inBounds(board, x, y)) return 'out-of-bounds';
  if (isPathTile(board, x, y)) return 'path-tile';
  if (occupied.some((t) => t.x === x && t.y === y)) return 'occupied';
  return null;
}
