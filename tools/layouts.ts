import { placementError } from '../src/sim/board';
import { createRng, nextInt } from '../src/sim/rng';
import type { BoardDef, Tile } from '../src/sim/board';
import type { RunConfig } from '../src/sim/sim';

export type NamedLayout = { name: string; tiles: Tile[] };

/** Hand-authored against MILESTONE_1_BOARD (12x9), three desks: the shapes a player builds. */
export const NAMED_LAYOUTS: NamedLayout[] = [
  { name: 'spread',     tiles: [{ x: 3, y: 0 }, { x: 7, y: 2 }, { x: 8, y: 4 }] },
  { name: 'entrance',   tiles: [{ x: 1, y: 3 }, { x: 1, y: 5 }, { x: 3, y: 2 }] },
  { name: 'production', tiles: [{ x: 8, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 6 }] },
];

/** `count` distinct placeable tiles, drawn with the sim's own RNG so a sweep stays replayable. */
export function randomLayout(board: BoardDef, count: number, seed: number): Tile[] {
  const free: Tile[] = [];
  for (let y = 0; y < board.height; y += 1) {
    for (let x = 0; x < board.width; x += 1) {
      if (placementError(board, [], x, y) === null) free.push({ x, y });
    }
  }
  let state = createRng(seed);
  const picked: Tile[] = [];
  for (let i = 0; i < count && free.length > 0; i += 1) {
    const draw = nextInt(state, free.length);
    state = draw.state;
    picked.push(free.splice(draw.value, 1)[0]);
  }
  return picked;
}

/** The layout axis: the three named shapes plus a per-seed random sample, so no configuration
 *  is judged on one lucky arrangement. */
export type LayoutAxis = { name: string; tilesFor: (config: RunConfig, seed: number) => Tile[] };

export const LAYOUT_AXIS: LayoutAxis[] = [
  ...NAMED_LAYOUTS.map((layout) => ({ name: layout.name, tilesFor: () => layout.tiles })),
  {
    name: 'random',
    tilesFor: (config, seed) => randomLayout(config.board, config.rules.deskBudget, seed),
  },
];
