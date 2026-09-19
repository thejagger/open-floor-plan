import type { JSX } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, Color, SRGBColorSpace } from 'three';
import { GameContext } from '../game/GameContext';
import type { GameCtx } from '../game/GameContext';
import { CAMERA } from './tuning';
import { BACKDROP_COLOUR } from '../theme';
import { Scene } from './Scene';

export function Stage({ ctx }: { ctx: GameCtx }): JSX.Element {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: CAMERA.position }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = SRGBColorSpace;
        gl.info.autoReset = false; // SceneProbe resets it
        scene.background = new Color(BACKDROP_COLOUR);
      }}
    >
      {/* Re-declared inside the Canvas on purpose: the engine reaches the scene without
          depending on r3f bridging React context across its own reconciler. */}
      <GameContext.Provider value={ctx}>
        <Scene />
      </GameContext.Provider>
    </Canvas>
  );
}
