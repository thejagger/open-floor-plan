import { useRef } from 'react';
import type { JSX } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../../game/GameContext';
import { POP_SLOTS } from './bus';
import { BUG_Y, POP_MS } from '../tuning';
import { BUG_COLOUR } from '../../theme';

const dummy = new THREE.Object3D();
const colour = new THREE.Color(BUG_COLOUR.typo);

/** Death pops render in their own instanced mesh, never as extra instances of the bug mesh, so
 *  "bug objects in the scene == live bugs" holds at every instant, including mid-animation. */
export function DeathPops(): JSX.Element {
  const { bus } = useGame();
  const ref = useRef<THREE.InstancedMesh>(null!);

  useFrame(() => {
    const mesh = ref.current;
    const now = performance.now();
    // drop pops older than their lifetime so the array never grows unbounded
    while (bus.pops.length && now - bus.pops[0].born > POP_MS) bus.pops.shift();

    let i = 0;
    for (const pop of bus.pops) {
      const age = Math.min(1, (now - pop.born) / POP_MS);
      const scale = 1 + age * 1.2;
      dummy.position.set(pop.x, BUG_Y, pop.y);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      i += 1;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh name="pops" ref={ref} frustumCulled={false} args={[undefined, undefined, POP_SLOTS]}>
      <icosahedronGeometry args={[0.2, 0]} />
      <meshBasicMaterial color={colour} transparent opacity={0.6} />
    </instancedMesh>
  );
}
