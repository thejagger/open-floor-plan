import { create } from 'zustand';
import type { EntityId } from '../sim';

/** UI-only. The sim has no notion of a selected desk and must not gain one. */
export type SelectionState = { deskId: EntityId | null };

export const useSelection = create<SelectionState>(() => ({ deskId: null }));

export function selectDesk(deskId: EntityId): void {
  useSelection.setState({ deskId });
}

export function clearSelection(): void {
  useSelection.setState({ deskId: null });
}
