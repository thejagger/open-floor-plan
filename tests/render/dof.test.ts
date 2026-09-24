import { describe, expect, it } from 'vitest';
import { BOARD_CENTRE, BOARD_H, BOARD_W, CAMERA, DOF, ORBIT } from '../../src/render/tuning';

type V3 = [number, number, number];
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * postprocessing's CoC pass, in plain math: `focusDistance` and `focusRange` are world units
 * measured from the camera, and Scene autofocuses on BOARD_CENTRE, so the focus distance is
 * the camera's distance to it. Returns 0 (sharp) .. 1 (full bokeh).
 */
function coc(camera: V3, point: V3): number {
  const focusDistance = dist(camera, BOARD_CENTRE);
  return smoothstep(0, DOF.focusRange, Math.abs(dist(camera, point) - focusDistance));
}

/** Outer corners of the board — the tiles furthest from the focus point. */
const CORNERS: V3[] = [
  [-0.5, 0, -0.5],
  [BOARD_W - 0.5, 0, -0.5],
  [-0.5, 0, BOARD_H - 0.5],
  [BOARD_W - 0.5, 0, BOARD_H - 0.5],
];

/** Every camera OrbitControls can reach, sampled around BOARD_CENTRE. */
function orbitCameras(): V3[] {
  const cams: V3[] = [];
  for (const r of [ORBIT.minDistance, ORBIT.maxDistance]) {
    for (let polar = ORBIT.minPolarDeg; polar <= ORBIT.maxPolarDeg; polar += 5) {
      for (let az = 0; az < 360; az += 15) {
        const p = (polar * Math.PI) / 180;
        const a = (az * Math.PI) / 180;
        cams.push([
          BOARD_CENTRE[0] + r * Math.sin(p) * Math.sin(a),
          BOARD_CENTRE[1] + r * Math.cos(p),
          BOARD_CENTRE[2] + r * Math.sin(p) * Math.cos(a),
        ]);
      }
    }
  }
  return cams;
}

describe('depth of field', () => {
  it('keeps the whole board sharp from the default camera', () => {
    for (const corner of CORNERS) expect(coc(CAMERA.position, corner)).toBeLessThan(0.1);
  });

  it('keeps the whole board near-sharp from anywhere the orbit can reach', () => {
    for (const cam of orbitCameras()) {
      for (const corner of CORNERS) expect(coc(cam, corner)).toBeLessThan(0.2);
    }
  });
});
