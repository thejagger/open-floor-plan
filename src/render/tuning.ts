import { MILESTONE_1_BOARD } from '../content/board';

export const BOARD_W = MILESTONE_1_BOARD.width; // 12
export const BOARD_H = MILESTONE_1_BOARD.height; // 9
/** Board origin is the north-west tile centre: tile (x,y) sits at world (x, 0, y). */
export const BOARD_CENTRE: [number, number, number] = [(BOARD_W - 1) / 2, 0, (BOARD_H - 1) / 2];

export const CAMERA = {
  fov: 30,
  near: 0.1,
  far: 100,
  position: [5.5, 13, 16] as [number, number, number], // polar ~51deg, distance ~20.6
};
export const ORBIT = {
  minPolarDeg: 35,
  maxPolarDeg: 70, // never edge-on, never top-down
  minDistance: 12,
  maxDistance: 30,
};

export const FLOOR_Y = 0;
export const DESK_Y = 0.12;
export const BUG_Y = 0.3;
/** Height of Ground's invisible pointer plane. projectTile must target this same height —
 *  not DESK_Y or FLOOR_Y — or a click computed against a different height parallax-shifts off
 *  the tile it meant to hit once the camera isn't looking straight down. */
export const GROUND_Y = FLOOR_Y + 0.05;
/** Above the path tiles (their top face is at 0.06) so an aura ring is not swallowed by the
 *  corridor it most often overlaps; the selection ring sits one hair above the aura. */
export const AURA_Y = FLOOR_Y + 0.07;
export const SELECT_Y = FLOOR_Y + 0.08;

export const DOF = { focusDistance: 0.012, focalLength: 0.06, bokehScale: 3.5 };
export const BLOOM = { intensity: 0.7, luminanceThreshold: 0.95, luminanceSmoothing: 0.2 };
export const VIGNETTE = { offset: 0.28, darkness: 0.85 };

export const FLASH_MS = 130;
export const POP_MS = 260;
export const TRACER_MS = 110;
export const SHAKE_MS = 260;
export const SHAKE_STRENGTH = 0.22;
export const DAMAGE_LIFE_MS = 750;
export const DAMAGE_RISE = 0.9;
