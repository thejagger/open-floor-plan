import { create } from 'zustand';
import type { Phase, Snapshot } from '../sim';

export const HUD_SYNC_MS = 200; // ~5Hz — the HUD does not update at tick rate

export type HudState = {
  phase: Phase;
  wave: number;
  waveCount: number;
  uptime: number;
  maxUptime: number;
  desksPlaced: number;
  deskBudget: number;
};

const INITIAL_HUD: HudState = {
  phase: 'build',
  wave: 1,
  waveCount: 0,
  uptime: 0,
  maxUptime: 0,
  desksPlaced: 0,
  deskBudget: 0,
};

export const useHud = create<HudState>(() => INITIAL_HUD);

function fromSnapshot(snap: Snapshot): HudState {
  return {
    phase: snap.phase,
    wave: snap.wave,
    waveCount: snap.waveCount,
    uptime: snap.uptime,
    maxUptime: snap.maxUptime,
    desksPlaced: snap.desksPlaced,
    deskBudget: snap.deskBudget,
  };
}

function shallow(a: HudState, b: HudState): boolean {
  return (
    a.phase === b.phase &&
    a.wave === b.wave &&
    a.waveCount === b.waveCount &&
    a.uptime === b.uptime &&
    a.maxUptime === b.maxUptime &&
    a.desksPlaced === b.desksPlaced &&
    a.deskBudget === b.deskBudget
  );
}

/** Called from the frame loop on the HUD_SYNC_MS throttle; a no-op when nothing changed. */
export function syncHud(snap: Snapshot): void {
  const next = fromSnapshot(snap);
  if (!shallow(useHud.getState(), next)) useHud.setState(next);
}

/** Immediate, unthrottled — used when a run is created or restarted. */
export function resetHud(snap: Snapshot): void {
  useHud.setState(fromSnapshot(snap));
}
