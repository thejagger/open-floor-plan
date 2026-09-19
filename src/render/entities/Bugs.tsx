import { useRef } from 'react';
import type { JSX } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../../game/GameContext';
import { BUG_FALLBACK } from '../registry';
import { BUG_Y } from '../tuning';
import { FLASH_COLOUR } from '../../theme';

const MAX_BUG_INSTANCES = 64; // wave 5 peaks around 25 live Typos; head-room for later waves

const dummy = new THREE.Object3D();
const flashColour = new THREE.Color(FLASH_COLOUR);
const baseColour = new THREE.Color(BUG_FALLBACK.colour);

export function Bugs(): JSX.Element {
  const { engine, bus } = useGame();
  const ref = useRef<THREE.InstancedMesh>(null!);
  useFrame(() => {
    const mesh = ref.current;
    const { current, previousById, alpha } = engine;
    const now = performance.now();
    let i = 0;
    for (const bug of current.bugs) {
      if (i >= MAX_BUG_INSTANCES) break;
      const from = previousById.get(bug.id) ?? bug;
      dummy.position.set(
        from.x + (bug.x - from.x) * alpha,
        BUG_Y,
        from.y + (bug.y - from.y) * alpha,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, (bus.flashes.get(bug.id) ?? 0) > now ? flashColour : baseColour);
      i += 1;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh name="bugs" ref={ref} castShadow frustumCulled={false}
                   args={[undefined, undefined, MAX_BUG_INSTANCES]}>
      <icosahedronGeometry args={[BUG_FALLBACK.radius, BUG_FALLBACK.detail]} />
      <meshStandardMaterial color={BUG_FALLBACK.colour} roughness={0.45} metalness={0.05} />
    </instancedMesh>
  );
}
