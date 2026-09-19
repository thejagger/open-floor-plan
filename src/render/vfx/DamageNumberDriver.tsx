import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../../game/GameContext';
import { BUG_Y, DAMAGE_LIFE_MS, DAMAGE_RISE } from '../tuning';

const v = new THREE.Vector3();

/** Inside the Canvas: projects each active damage slot's world position through the camera
 *  and writes transform/opacity straight onto its pooled DOM node — nothing here goes through
 *  React state. */
export function DamageNumberDriver(): null {
  const { bus } = useGame();
  const { camera, size } = useThree();

  useFrame(() => {
    const now = performance.now();
    for (const slot of bus.damage) {
      if (!slot.active || !slot.el) continue;
      const age = now - slot.born;
      if (age > DAMAGE_LIFE_MS) {
        slot.active = false;
        slot.el.style.opacity = '0';
        continue;
      }
      const t = age / DAMAGE_LIFE_MS;
      v.set(slot.x, BUG_Y + t * DAMAGE_RISE, slot.y);
      v.project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      slot.el.textContent = `-${slot.value}`;
      slot.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      slot.el.style.opacity = String(Math.max(0, 1 - t));
    }
  });

  return null;
}
