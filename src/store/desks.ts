import { create } from 'zustand';
import type { Snapshot, SnapshotDesk } from '../sim';

export type DesksState = { desks: SnapshotDesk[] };

export const useDesks = create<DesksState>(() => ({ desks: [] }));

/** Every field the inspector displays. `title` needs no entry — it is derived from craft and
 *  process, which are both here. `cooldownRemaining` is deliberately absent: it changes every
 *  tick and nothing on the panel shows it. */
function signature(desks: readonly SnapshotDesk[]): string {
  let sig = '';
  for (const d of desks) {
    sig += `${d.id}:${d.x}:${d.y}:${d.xp}:${d.craft}:${d.process}:${d.damage}:${d.range}`
      + `:${d.auraRadius}:${d.lockedPath}:${d.nextPrice.craft}:${d.nextPrice.process}|`;
  }
  return sig;
}

// Module scope so it survives React's render, and reset by `resetDesks` on a restart — the same
// shape `SceneProbe` uses for `stats`.
let lastSig = '';

/** Called from the frame loop on the HUD_SYNC_MS throttle; a no-op when nothing changed. */
export function syncDesks(snap: Snapshot): void {
  const sig = signature(snap.desks);
  if (sig === lastSig) return;
  lastSig = sig;
  useDesks.setState({ desks: snap.desks });
}

/** Immediate, unthrottled — used when a run is created or restarted. */
export function resetDesks(snap: Snapshot): void {
  lastSig = signature(snap.desks);
  useDesks.setState({ desks: snap.desks });
}
