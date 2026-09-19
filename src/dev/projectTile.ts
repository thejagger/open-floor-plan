import * as THREE from 'three';
import type { WebGLRenderer } from 'three';
import { GROUND_Y } from '../render/tuning';

/** Maps a board tile's centre in world space to CSS-pixel canvas coordinates, so a Playwright
 *  test can click a tile without hard-coding pixels against the camera. Projected at GROUND_Y —
 *  the same height Ground's pointer plane raycasts against — so the perspective camera's
 *  parallax doesn't shift the click off the tile it meant to hit. */
export function projectTile(
  tile: { x: number; y: number },
  camera: THREE.Camera,
  size: { width: number; height: number },
  gl: WebGLRenderer,
): { x: number; y: number } {
  const world = new THREE.Vector3(tile.x, GROUND_Y, tile.y);
  world.project(camera);
  const rect = gl.domElement.getBoundingClientRect();
  const x = rect.left + ((world.x + 1) / 2) * size.width;
  const y = rect.top + ((1 - world.y) / 2) * size.height;
  return { x, y };
}
