import type { JSX } from 'react';
import { useHud } from '../store/hud';

export function Overlays({ onRestart }: { onRestart: () => void }): JSX.Element | null {
  const { phase, wave, waveCount, uptime } = useHud();
  if (phase !== 'victory' && phase !== 'defeat') return null;

  const isVictory = phase === 'victory';

  return (
    <div className="overlay" data-testid={isVictory ? 'overlay-victory' : 'overlay-defeat'}>
      <div className="overlay__panel">
        <h1 className="overlay__title">{isVictory ? 'Victory' : 'Defeat'}</h1>
        <p className="overlay__stat">Wave {wave} / {waveCount}</p>
        <p className="overlay__stat">Uptime {uptime}</p>
        <button className="overlay__restart" data-testid="restart" onClick={onRestart}>
          New run
        </button>
      </div>
    </div>
  );
}
