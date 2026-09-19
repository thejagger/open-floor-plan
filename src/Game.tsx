import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { createEngine } from './game/engine';
import { GameContext } from './game/GameContext';
import { nextSeed } from './game/seed';
import { createVfxBus } from './render/vfx/bus';
import { resetHud } from './store/hud';
import { installBridge, clearBridge } from './dev/bridge';
import { Stage } from './render/Stage';
import { Hud } from './ui/Hud';
import { Overlays } from './ui/Overlays';
import { DamageNumbers } from './ui/DamageNumbers';

export function Game({ seed }: { seed: number }): JSX.Element {
  const [run, setRun] = useState(() => ({ seed, key: 0 }));
  const restart = useCallback(
    () => setRun((r) => ({ seed: nextSeed(r.seed), key: r.key + 1 })),
    [],
  );
  return <GameRun key={run.key} seed={run.seed} onRestart={restart} />;
}

function GameRun({ seed, onRestart }: { seed: number; onRestart: () => void }): JSX.Element {
  const engine = useMemo(() => createEngine(seed), [seed]);
  const bus = useMemo(() => createVfxBus(), []);
  const ctx = useMemo(() => ({ engine, bus, restart: onRestart }), [engine, bus, onRestart]);

  useEffect(() => {
    resetHud(engine.current);
  }, [engine]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    installBridge({
      snapshot: () => engine.current,
      seed: () => engine.seed,
      setTimeScale: (s) => {
        engine.timeScale = s;
      },
    });
    return () => clearBridge(['snapshot', 'seed', 'setTimeScale']);
  }, [engine]);

  const onStart = useCallback(() => engine.submit({ type: 'StartSprint' }), [engine]);

  return (
    <GameContext.Provider value={ctx}>
      <Stage ctx={ctx} />
      <Hud onStart={onStart} />
      <Overlays onRestart={onRestart} />
      <DamageNumbers />
    </GameContext.Provider>
  );
}
