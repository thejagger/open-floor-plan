import type { ComponentType } from 'react';
import { BUG_COLOUR } from '../theme';
import { PrimitiveDesk } from './entities/PrimitiveDesk';

export type DeskVisualProps = {
  x: number;
  y: number;
  role: string;
  /** craft level 0..5 — visible mass, not a stat */
  craft?: number;
  /** unspent XP waiting to be spent, which the build phase would otherwise hide */
  unspent?: boolean;
};

/** Entity type -> component. Swapping a primitive for a loaded GLB is a one-line change here. */
export const DESK_VISUALS: Record<string, ComponentType<DeskVisualProps>> = {
  developer: PrimitiveDesk,
};
export const DESK_FALLBACK = PrimitiveDesk;

/** Swarm entities render instanced, so their entry is geometry + colour, not a component. */
export type BugVisual = { radius: number; colour: string; detail: number };
export const BUG_VISUALS: Record<string, BugVisual> = {
  typo: { radius: 0.2, colour: BUG_COLOUR.typo, detail: 0 },
};
export const BUG_FALLBACK = BUG_VISUALS.typo;
