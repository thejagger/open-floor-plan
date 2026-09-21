import { useRef, useState } from 'react';
import type { JSX } from 'react';
import { useFrame } from '@react-three/fiber';
import { useEngine } from '../../game/GameContext';
import { useSelection } from '../../store/selection';
import { DESK_FALLBACK, DESK_VISUALS } from '../registry';
import { AURA_Y, SELECT_Y } from '../tuning';
import { AURA_COLOUR, SELECT_COLOUR } from '../../theme';
import type { SnapshotDesk } from '../../sim';

/**
 * Cheap fingerprint of everything this group *draws*. Gating the resync on `desks.length` alone
 * misses a tick batch that removes one desk and places another in the same tick (sim.ts applies
 * a whole command batch in one tick): the count nets to the same number, so a length check never
 * fires. The levels are in it because buying one changes the model and the aura ring without
 * moving anybody, and `xp > 0` because the unspent badge appears and disappears mid-wave.
 * (`store/desks.ts` fingerprints a different set — the values the *inspector* displays — and is
 * published on the HUD throttle rather than per frame.)
 */
function signature(desks: readonly SnapshotDesk[]): string {
  let sig = '';
  for (const d of desks) sig += `${d.id}:${d.x}:${d.y}:${d.craft}:${d.process}:${d.xp > 0 ? 1 : 0}|`;
  return sig;
}

export function Desks(): JSX.Element {
  const engine = useEngine();
  const selectedId = useSelection((s) => s.deskId);
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

  const selected = desks.find((d) => d.id === selectedId) ?? null;

  return (
    <>
      <group name="desks">
        {desks.map((d) => {
          const Visual = DESK_VISUALS[d.role] ?? DESK_FALLBACK;
          return (
            <Visual key={d.id} x={d.x} y={d.y} role={d.role} craft={d.craft} unspent={d.xp > 0} />
          );
        })}
      </group>
      {/* The ring IS the buff reach: its outer radius is the snapshot's `auraRadius`, untouched,
          and SceneProbe reads it back off the geometry so a test compares the two numbers rather
          than two copies of the same one. */}
      <group name="auras">
        {desks.filter((d) => d.auraRadius > 0).map((d) => (
          <mesh
            key={d.id}
            name={`aura-${d.id}`}
            rotation-x={-Math.PI / 2}
            position={[d.x, AURA_Y, d.y]}
          >
            <ringGeometry args={[Math.max(0, d.auraRadius - 0.1), d.auraRadius, 64]} />
            <meshBasicMaterial transparent opacity={0.3} color={AURA_COLOUR} />
          </mesh>
        ))}
      </group>
      <group name="selection">
        {selected && (
          <mesh
            name="selection-ring"
            rotation-x={-Math.PI / 2}
            position={[selected.x, SELECT_Y, selected.y]}
          >
            <ringGeometry args={[0.44, 0.5, 32]} />
            <meshBasicMaterial transparent opacity={0.9} color={SELECT_COLOUR} />
          </mesh>
        )}
      </group>
    </>
  );
}
