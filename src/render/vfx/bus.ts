import type { EntityId } from '../../sim';
import type { Engine } from '../../game/engine';
import { FLASH_MS, SHAKE_MS, SHAKE_STRENGTH } from '../tuning';

export type DamageSlot = {
  el: HTMLDivElement | null;
  x: number;
  y: number;
  born: number;
  active: boolean;
  value: number;
};

export type VfxBus = {
  /** bugId -> the performance.now() the flash ends at */
  flashes: Map<EntityId, number>;
  pops: { x: number; y: number; born: number }[];
  tracers: { fx: number; fy: number; tx: number; ty: number; born: number }[];
  shake: { until: number; strength: number };
  damage: DamageSlot[]; // fixed pool, filled round-robin
  /** cursor into `damage`, part of the bus so a restart's fresh bus starts a fresh rotation */
  nextDamageSlot: number;
};

export const DAMAGE_SLOTS = 24;
export const POP_SLOTS = 16;
export const TRACER_SLOTS = 8;

export function createVfxBus(): VfxBus {
  return {
    flashes: new Map(),
    pops: [],
    tracers: [],
    shake: { until: 0, strength: 0 },
    damage: Array.from({ length: DAMAGE_SLOTS }, () => (
      { el: null, x: 0, y: 0, born: 0, active: false, value: 0 }
    )),
    nextDamageSlot: 0,
  };
}

function placeDamage(bus: VfxBus, x: number, y: number, now: number, value: number): void {
  const slot = bus.damage[bus.nextDamageSlot % bus.damage.length];
  bus.nextDamageSlot += 1;
  slot.x = x;
  slot.y = y;
  slot.born = now;
  slot.active = true;
  slot.value = value;
}

/** Drains the sim's event queue into the bus. Juice belongs to the moment the sim said
 *  something happened, and events already carry that; diffing snapshots would reconstruct
 *  information the sim has already stated. */
export function drainVfx(bus: VfxBus, engine: Engine, now: number): void {
  const positionOf = (id: EntityId): { x: number; y: number } => {
    const seen = engine.lastSeen.get(id);
    if (seen) return seen;
    const bug = engine.current.bugs.find((b) => b.id === id);
    return bug ? { x: bug.x, y: bug.y } : { x: 0, y: 0 };
  };
  const deskAt = (id: EntityId): { x: number; y: number } | null => {
    const desk = engine.current.desks.find((d) => d.id === id) ?? engine.previous.desks.find((d) => d.id === id);
    return desk ? { x: desk.x, y: desk.y } : null;
  };

  for (const event of engine.events) {
    if (event.type === 'BugDamaged') {
      bus.flashes.set(event.bugId, now + FLASH_MS);
      const p = positionOf(event.bugId);
      placeDamage(bus, p.x, p.y, now, event.damage);
    } else if (event.type === 'BugKilled') {
      const p = positionOf(event.bugId);
      bus.pops.push({ x: p.x, y: p.y, born: now });
      if (bus.pops.length > POP_SLOTS) bus.pops.splice(0, bus.pops.length - POP_SLOTS);
    } else if (event.type === 'DeskFired') {
      const from = deskAt(event.deskId);
      const to = positionOf(event.targetId);
      if (from) {
        bus.tracers.push({ fx: from.x, fy: from.y, tx: to.x, ty: to.y, born: now });
        if (bus.tracers.length > TRACER_SLOTS) bus.tracers.splice(0, bus.tracers.length - TRACER_SLOTS);
      }
    } else if (event.type === 'UptimeLost') {
      bus.shake = { until: now + SHAKE_MS, strength: SHAKE_STRENGTH };
    }
  }

  engine.events.length = 0;
  engine.lastSeen.clear();
}
