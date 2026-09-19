import type { JSX } from 'react';
import { useGame } from '../game/GameContext';
import { DAMAGE_SLOTS } from '../render/vfx/bus';

/** Outside the Canvas: renders the fixed pool of damage-number nodes once and assigns each
 *  into bus.damage[i].el. Nothing about a floating number goes through React state again; the
 *  numbers are HUD DOM, so they share the HUD's typography. */
export function DamageNumbers(): JSX.Element {
  const { bus } = useGame();
  return (
    <div className="damage-numbers" aria-hidden="true">
      {Array.from({ length: DAMAGE_SLOTS }, (_, i) => (
        <div
          key={i}
          className="damage-number"
          ref={(el) => {
            bus.damage[i].el = el;
          }}
        />
      ))}
    </div>
  );
}
