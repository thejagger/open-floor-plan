import { useRef } from 'react';
import type { JSX } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { useGame } from '../../game/GameContext';
import { TRACER_SLOTS } from './bus';
import { BUG_Y, TRACER_MS } from '../tuning';
import { ROLE_COLOUR } from '../../theme';

/** Decorative tracers between a desk and its target on DeskFired — the sim's hit model is
 *  instant, per sim-core's Decisions, so these are visual flourish only. */
export function Tracers(): JSX.Element {
  const { bus } = useGame();
  const refs = useRef<(Mesh | null)[]>([]);

  useFrame(() => {
    const now = performance.now();
    while (bus.tracers.length && now - bus.tracers[0].born > TRACER_MS) bus.tracers.shift();

    for (let i = 0; i < TRACER_SLOTS; i += 1) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const tracer = bus.tracers[i];
      if (!tracer) {
        mesh.visible = false;
        continue;
      }
      const dx = tracer.tx - tracer.fx;
      const dz = tracer.ty - tracer.fy;
      const length = Math.max(0.001, Math.hypot(dx, dz));
      mesh.visible = true;
      mesh.position.set((tracer.fx + tracer.tx) / 2, BUG_Y, (tracer.fy + tracer.ty) / 2);
      mesh.rotation.set(0, -Math.atan2(dz, dx), 0);
      mesh.scale.set(length, 1, 1);
    }
  });

  return (
    <group name="tracers">
      {Array.from({ length: TRACER_SLOTS }, (_, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} visible={false}>
          <boxGeometry args={[1, 0.02, 0.02]} />
          <meshBasicMaterial color={ROLE_COLOUR.developer} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}
