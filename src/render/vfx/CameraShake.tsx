import { useFrame } from '@react-three/fiber';
import { useGame } from '../../game/GameContext';
import { SHAKE_MS } from '../tuning';

/** Runs at default priority, after drei's OrbitControls (priority -1) has written the camera,
 *  adding a decaying random offset. The controls rewrite position from their own spherical
 *  state next frame, so the offset never accumulates. */
export function CameraShake(): null {
  const { bus } = useGame();
  useFrame(({ camera }) => {
    const now = performance.now();
    const remaining = bus.shake.until - now;
    if (remaining <= 0) return;
    const strength = bus.shake.strength * (remaining / SHAKE_MS);
    camera.position.x += (Math.random() - 0.5) * strength;
    camera.position.y += (Math.random() - 0.5) * strength;
    camera.position.z += (Math.random() - 0.5) * strength;
  });
  return null;
}
