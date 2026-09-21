import type { EntityId } from './entities';
import type { Path } from './progression';

export type PlaceDesk   = { type: 'PlaceDesk'; x: number; y: number };
export type RemoveDesk  = { type: 'RemoveDesk'; deskId: EntityId };
export type StartSprint = { type: 'StartSprint' };
export type BuyLevel = { type: 'BuyLevel'; deskId: EntityId; path: Path };
export type MoveDesk = { type: 'MoveDesk'; deskId: EntityId; x: number; y: number };
export type Command = PlaceDesk | RemoveDesk | StartSprint | BuyLevel | MoveDesk;
