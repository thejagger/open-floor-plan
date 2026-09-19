import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import type { DirectionalLight } from 'three';
import { BOARD_CENTRE, BOARD_H, BOARD_W } from './tuning';

export function Lights(): JSX.Element {
  const keyRef = useRef<DirectionalLight>(null);

  useEffect(() => {
    const light = keyRef.current;
    if (!light) return;
    const cam = light.shadow.camera;
    const half = Math.max(BOARD_W, BOARD_H) / 2 + 2;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 40;
    light.target.position.set(BOARD_CENTRE[0], 0, BOARD_CENTRE[2]);
    light.target.updateMatrixWorld();
    cam.updateProjectionMatrix();
  }, []);

  return (
    <>
      <directionalLight
        ref={keyRef}
        castShadow
        color="#ffd9a8"
        intensity={2.4}
        position={[8, 12, 6]}
      />
      <directionalLight color="#8fb6ff" intensity={0.7} position={[-8, 6, 8]} />
      <directionalLight color="#ffffff" intensity={1.6} position={[-4, 5, -10]} />
      <ambientLight intensity={0.25} />
    </>
  );
}
