import type { JSX } from 'react';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';
import { MathUtils } from 'three';
import { useGame } from '../game/GameContext';
import { GameDriver } from './GameDriver';
import { Lights } from './Lights';
import { Board } from './Board';
import { Desks } from './entities/Desks';
import { Bugs } from './entities/Bugs';
import { DeathPops } from './vfx/DeathPops';
import { Tracers } from './vfx/Tracers';
import { CameraShake } from './vfx/CameraShake';
import { DamageNumberDriver } from './vfx/DamageNumberDriver';
import { Ground } from './Ground';
import { BOARD_CENTRE, BOARD_H, BOARD_W, DOF, BLOOM, FLOOR_Y, ORBIT, VIGNETTE } from './tuning';
import { SceneProbe } from '../dev/SceneProbe';
import { EFFECTS_ENABLED } from '../dev/flags';

const { degToRad } = MathUtils;

/** Mount order is `useFrame` order, and SceneProbe must be last so it samples a frame every
 *  other callback has finished writing. */
export function Scene(): JSX.Element {
  const { engine } = useGame();
  return (
    <>
      <GameDriver />
      <Lights />
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2} position={[0, 6, 4]} scale={[8, 4, 1]} color="#ffd9a8" />
        <Lightformer intensity={1.2} position={[-6, 3, -4]} scale={[6, 4, 1]} color="#8fb6ff" />
        <Lightformer intensity={0.8} position={[6, 2, -6]} scale={[6, 3, 1]} color="#ffffff" />
      </Environment>
      <Board />
      <Desks />
      <Bugs />
      <DeathPops />
      <Tracers />
      <DamageNumberDriver />
      <CameraShake />
      <Ground />
      <ContactShadows
        position={[BOARD_CENTRE[0], FLOOR_Y + 0.01, BOARD_CENTRE[2]]}
        width={BOARD_W + 4}
        height={BOARD_H + 4}
        opacity={0.55}
        blur={2.2}
        far={6}
        resolution={1024}
      />
      <OrbitControls
        makeDefault
        enablePan={false}
        // Damping is drei's default, but it eases the *initial* target from three.js's default
        // (0,0,0) to BOARD_CENTRE over the first second or so of frames rather than snapping —
        // during that window the camera is still drifting, so a click computed against it can
        // land off the tile it meant to hit. The board is a static diorama rig, not a scene that
        // benefits from inertia, so damping buys nothing here and costs this correctness window.
        enableDamping={false}
        target={BOARD_CENTRE}
        minPolarAngle={degToRad(ORBIT.minPolarDeg)}
        maxPolarAngle={degToRad(ORBIT.maxPolarDeg)}
        minDistance={ORBIT.minDistance}
        maxDistance={ORBIT.maxDistance}
      />
      {EFFECTS_ENABLED && (
        <EffectComposer>
          <DepthOfField {...DOF} />
          <Bloom mipmapBlur {...BLOOM} />
          <Vignette {...VIGNETTE} />
        </EffectComposer>
      )}
      {import.meta.env.DEV && <SceneProbe bugsLive={() => engine.current.bugs.length} />}
    </>
  );
}
