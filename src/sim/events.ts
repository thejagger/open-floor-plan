import type { EntityId } from './entities';

export type BugSpawned  = { type: 'BugSpawned'; bugId: EntityId; bugType: string; hp: number };
export type BugDamaged  = { type: 'BugDamaged'; bugId: EntityId; deskId: EntityId; damage: number; hpRemaining: number };
export type BugKilled   = { type: 'BugKilled'; bugId: EntityId; deskId: EntityId };
export type BugLeaked   = { type: 'BugLeaked'; bugId: EntityId; leakCost: number };
export type DeskFired   = { type: 'DeskFired'; deskId: EntityId; targetId: EntityId; damage: number };
export type UptimeLost  = { type: 'UptimeLost'; amount: number; uptime: number };
export type WaveEnded   = { type: 'WaveEnded'; wave: number; uptime: number }; // wave is 1-based
export type RunOver     = { type: 'RunOver'; outcome: 'victory' | 'defeat'; wave: number; uptime: number };

export type SimEvent =
  | BugSpawned | BugDamaged | BugKilled | BugLeaked
  | DeskFired | UptimeLost | WaveEnded | RunOver;
