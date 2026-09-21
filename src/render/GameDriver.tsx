import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../game/GameContext';
import { drainVfx } from './vfx/bus';
import { HUD_SYNC_MS, syncHud } from '../store/hud';
import { syncDesks } from '../store/desks';

/** The single rAF owner: steps the sim, drains events into the vfx bus, throttles the HUD. */
export function GameDriver(): null {
  const ctx = useGame();
  const lastSync = useRef(0);
  useFrame((_, delta) => {
    const { engine, bus } = ctx;
    engine.advance(delta * 1000);
    const now = performance.now();
    drainVfx(bus, engine, now);
    if (now - lastSync.current >= HUD_SYNC_MS) {
      lastSync.current = now;
      syncHud(engine.current);
      syncDesks(engine.current);
    }
  });
  return null;
}
