import { useRef, useState } from 'react';
import type { JSX } from 'react';
import { useFrame } from '@react-three/fiber';
import { useEngine } from '../../game/GameContext';
import { DESK_FALLBACK, DESK_VISUALS } from '../registry';

/** Cheap id/x/y fingerprint of the desk set. Gating the resync on `desks.length` alone misses a
 *  tick batch that removes one desk and places another in the same tick (sim.ts applies a whole
 *  command batch in one tick): the count nets to the same number, so a length check never fires
 *  and the group keeps drawing the old desk until some later click happens to change the count. */
function signature(desks: readonly { id: number; x: number; y: number }[]): string {
  let sig = '';
  for (const d of desks) sig += `${d.id}:${d.x}:${d.y}|`;
  return sig;
}

export function Desks(): JSX.Element {
  const engine = useEngine();
  // Re-renders on the desk set changing, sampled every frame — not gated behind the HUD's
  // 5Hz throttle. Desk placement is a correctness signal ("the desk I just clicked is on
  // screen"), not display polish, so it can't inherit the HUD's display-only latency budget.
  const [desks, setDesks] = useState(engine.current.desks);
  const lastSig = useRef(signature(desks));
  useFrame(() => {
    const current = engine.current.desks;
    const sig = signature(current);
    if (sig !== lastSig.current) {
      lastSig.current = sig;
      setDesks(current);
    }
  });
  return (
    <group name="desks">
      {desks.map((d) => {
        const Visual = DESK_VISUALS[d.role] ?? DESK_FALLBACK;
        return <Visual key={d.id} x={d.x} y={d.y} role={d.role} />;
      })}
    </group>
  );
}
