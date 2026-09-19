import type { CSSProperties, JSX } from 'react';
import { useHud } from '../store/hud';
import { ROLE_COLOUR } from '../theme';

export function Hud({ onStart }: { onStart: () => void }): JSX.Element {
  const { phase, wave, waveCount, uptime, maxUptime, desksPlaced, deskBudget } = useHud();

  return (
    <div className="hud" style={{ '--role-developer': ROLE_COLOUR.developer } as CSSProperties}>
      <div className="hud__stat">
        <span className="hud__label">Uptime</span>
        <span className="hud__value" data-testid="uptime">{uptime}</span>
        <span className="hud__sub">/ {maxUptime}</span>
      </div>
      <div className="hud__stat">
        <span className="hud__label">Wave</span>
        <span className="hud__value" data-testid="wave">{wave}</span>
        <span className="hud__sub">/ {waveCount}</span>
      </div>
      <div className="hud__stat">
        <span className="hud__label">Desks</span>
        <span className="hud__value" data-testid="desks-remaining">{deskBudget - desksPlaced}</span>
      </div>
      <button
        className="hud__start"
        data-testid="start-sprint"
        disabled={phase !== 'build'}
        onClick={onStart}
      >
        Start Sprint
      </button>
    </div>
  );
}
