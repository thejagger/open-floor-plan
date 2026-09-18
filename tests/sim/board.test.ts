import { describe, expect, it } from 'vitest';
import {
  entranceTile, pathLength, placementError, pointAtDistance, productionTile,
} from '../../src/sim/board';
import type { BoardDef } from '../../src/sim/board';

const board: BoardDef = {
  width: 4,
  height: 3,
  path: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
};

describe('path geometry', () => {
  it('interpolates along the path and clamps at the entrance and at Production', () => {
    expect(pathLength(board)).toBe(3);
    expect(pointAtDistance(board, 0)).toEqual({ x: 0, y: 1 });
    expect(pointAtDistance(board, 1.5)).toEqual({ x: 1.5, y: 1 });
    expect(pointAtDistance(board, 2.5)).toEqual({ x: 2, y: 1.5 });
    expect(pointAtDistance(board, 3)).toEqual({ x: 2, y: 2 });
    expect(pointAtDistance(board, 99)).toEqual(productionTile(board));
    expect(pointAtDistance(board, -5)).toEqual(entranceTile(board));
  });
});

describe('desk placement validity', () => {
  it('names path tiles, out-of-bounds tiles and occupied tiles', () => {
    expect(placementError(board, [], 0, 0)).toBeNull();
    expect(placementError(board, [], 1, 1)).toBe('path-tile');
    expect(placementError(board, [], -1, 0)).toBe('out-of-bounds');
    expect(placementError(board, [], 4, 0)).toBe('out-of-bounds');
    expect(placementError(board, [], 0, 3)).toBe('out-of-bounds');
    expect(placementError(board, [{ x: 0, y: 0 }], 0, 0)).toBe('occupied');
  });
});
