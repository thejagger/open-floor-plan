import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { useGame } from '../game/GameContext';
import { useHud } from '../store/hud';
import { useDesks } from '../store/desks';
import { clearSelection, useSelection } from '../store/selection';
import { MILESTONE_2_PROGRESSION as TABLE } from '../content/progression';
import type { Path } from '../content/progression';
import type { SnapshotDesk } from '../sim';
import { ROLE_COLOUR } from '../theme';
import { formatPrice, formatStat, formatTitle } from './format';

function Row({ label, testId, value }: {
  label: string; testId: string; value: string;
}): JSX.Element {
  return (
    <div className="inspector__row">
      <span className="inspector__label">{label}</span>
      <span className="inspector__value" data-testid={testId}>{value}</span>
    </div>
  );
}

function PathRow({ path, desk, buildPhase, onBuy }: {
  path: Path;
  desk: SnapshotDesk;
  buildPhase: boolean;
  onBuy: (path: Path) => void;
}): JSX.Element {
  const price = desk.nextPrice[path];
  const level = desk[path];
  // The cap *rule* has exactly one owner and it is `sim/progression.ts`; its verdict arrives here
  // as `nextPrice === null`. All this reads off the table is the constant, to say when the next
  // rung is the one that forecloses the other path — a warning before the fact, not a legality
  // check, and a commitment the player did not know they were making is a trap, not a choice.
  const locking = price !== null && level === TABLE.crossPathCap;
  return (
    <div className="inspector__path">
      <span className="inspector__label">{path}</span>
      <span className="inspector__value" data-testid={`level-${path}`}>{level}</span>
      <span className="inspector__price" data-testid={`price-${path}`}>{formatPrice(price)}</span>
      <button
        className="inspector__buy"
        data-testid={`buy-${path}`}
        disabled={!buildPhase || price === null || desk.xp < price}
        onClick={() => onBuy(path)}
      >
        Buy
      </button>
      {locking && (
        <span className="inspector__lock" data-testid={`lock-${path}`}>
          the last rung before the other path closes at {TABLE.crossPathCap}
        </span>
      )}
    </div>
  );
}

export function DeskInspector(): JSX.Element | null {
  const { engine } = useGame();
  const deskId = useSelection((s) => s.deskId);
  const desks = useDesks((s) => s.desks);
  const phase = useHud((s) => s.phase);
  const [confirming, setConfirming] = useState(false);

  // The confirmation belongs to the desk it was armed on, not to the panel.
  useEffect(() => setConfirming(false), [deskId]);

  const buy = useCallback((path: Path) => {
    if (deskId !== null) engine.submit({ type: 'BuyLevel', deskId, path });
  }, [engine, deskId]);

  const remove = useCallback(() => {
    if (deskId === null) return;
    engine.submit({ type: 'RemoveDesk', deskId });
    clearSelection();
  }, [engine, deskId]);

  const desk = deskId === null ? null : desks.find((d) => d.id === deskId) ?? null;
  if (!desk) return null;

  const buildPhase = phase === 'build';
  // The same expression sim.ts charges, off the same table — which is what lets the number shown
  // here and the number debited there be compared rather than assumed equal.
  const moveCost = Math.floor(desk.xp * TABLE.moveCostFraction);

  return (
    <div
      className="inspector"
      data-testid="inspector"
      data-desk={desk.id}
      style={{ '--role-developer': ROLE_COLOUR.developer } as CSSProperties}
    >
      <div className="inspector__head">
        <span className="inspector__title" data-testid="inspector-title">
          {formatTitle(desk.title)}
        </span>
        <button className="inspector__close" data-testid="inspector-close" onClick={clearSelection}>
          close
        </button>
      </div>
      <Row label="XP" testId="inspector-xp" value={formatStat(desk.xp)} />
      <Row label="Damage" testId="inspector-damage" value={formatStat(desk.damage)} />
      <Row label="Range" testId="inspector-range" value={formatStat(desk.range)} />
      <Row label="Move cost" testId="inspector-move-cost" value={formatStat(moveCost)} />
      <PathRow path="craft" desk={desk} buildPhase={buildPhase} onBuy={buy} />
      <PathRow path="process" desk={desk} buildPhase={buildPhase} onBuy={buy} />
      <div className="inspector__remove">
        {confirming ? (
          <>
            <button className="inspector__danger" data-testid="confirm-remove" onClick={remove}>
              Confirm — they are gone
            </button>
            <button data-testid="cancel-remove" onClick={() => setConfirming(false)}>Cancel</button>
          </>
        ) : (
          <button
            data-testid="remove-desk"
            disabled={!buildPhase}
            onClick={() => setConfirming(true)}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
