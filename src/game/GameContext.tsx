import { createContext, useContext } from 'react';
import type { Engine } from './engine';
import type { VfxBus } from '../render/vfx/bus';

export type GameCtx = { engine: Engine; bus: VfxBus; restart: () => void };

export const GameContext = createContext<GameCtx | null>(null);

export function useGame(): GameCtx {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameContext.Provider');
  return ctx;
}

export function useEngine(): Engine {
  return useGame().engine;
}
