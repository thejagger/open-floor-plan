import type { EntityId } from './entities';

export type PlaceDesk   = { type: 'PlaceDesk'; x: number; y: number };
export type RemoveDesk  = { type: 'RemoveDesk'; deskId: EntityId };
export type StartSprint = { type: 'StartSprint' };
export type Command = PlaceDesk | RemoveDesk | StartSprint;
