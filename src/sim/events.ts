import type { EntityId } from './entities';
import type { Path } from './progression';

export type BugSpawned  = { type: 'BugSpawned'; bugId: EntityId; bugType: string; hp: number };
export type BugDamaged  = { type: 'BugDamaged'; bugId: EntityId; deskId: EntityId; damage: number; hpRemaining: number };
export type BugKilled   = { type: 'BugKilled'; bugId: EntityId; deskId: EntityId };
export type BugLeaked   = { type: 'BugLeaked'; bugId: EntityId; leakCost: number };
export type DeskFired   = { type: 'DeskFired'; deskId: EntityId; targetId: EntityId; damage: number };
export type UptimeLost  = { type: 'UptimeLost'; amount: number; uptime: number };
export type WaveEnded   = { type: 'WaveEnded'; wave: number; uptime: number }; // wave is 1-based
export type RunOver     = { type: 'RunOver'; outcome: 'victory' | 'defeat'; wave: number; uptime: number };
export type XpGained    = { type: 'XpGained'; deskId: EntityId; amount: number; total: number; source: 'kill' | 'assist' };
export type LevelUp     = { type: 'LevelUp'; deskId: EntityId; path: Path; level: number; title: string };
export type DeskMoved   = { type: 'DeskMoved'; deskId: EntityId; x: number; y: number; xpSpent: number };
export type DeskRemoved = { type: 'DeskRemoved'; deskId: EntityId; xpLost: number };

export type SimEvent =
  | BugSpawned | BugDamaged | BugKilled | BugLeaked
  | DeskFired | UptimeLost | WaveEnded | RunOver
  | XpGained | LevelUp | DeskMoved | DeskRemoved;
