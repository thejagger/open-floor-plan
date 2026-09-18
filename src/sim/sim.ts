import { pathLength, placementError, pointAtDistance } from './board';
import type { BoardDef } from './board';
import { selectTarget } from './combat';
import type { Positioned } from './combat';
import type { Command } from './commands';
import { createBug, createDesk } from './entities';
import type { Bug, Desk, EntityId } from './entities';
import type { SimEvent } from './events';
import { createRng } from './rng';
import type { RngState } from './rng';
import { buildSchedule } from './waves';
import type { WaveDef } from './waves';
import { DEVELOPER } from '../content/roles';
import { MILESTONE_1_RUN } from '../content/run';

export const TICK_RATE = 20;

export type Phase = 'build' | 'running' | 'victory' | 'defeat';
export type RunRules = { startingUptime: number; deskBudget: number };

export type WaveRuntime = { schedule: number[]; spawned: number; waveTick: number };

export type RunState = {
  board: BoardDef;
  waves: WaveDef[];
  rngState: RngState;
  tick: number;
  phase: Phase;
  currentWave: number; // 0-based index
  uptime: number;
  maxUptime: number;
  deskBudget: number;
  nextEntityId: EntityId;
  desks: Desk[];
  bugs: Bug[];
  wave: WaveRuntime | null;
};

export function createRun(board: BoardDef, waves: WaveDef[], seed: number): RunState {
  return {
    board,
    waves,
    rngState: createRng(seed),
    tick: 0,
    phase: 'build',
    currentWave: 0,
    uptime: MILESTONE_1_RUN.startingUptime,
    maxUptime: MILESTONE_1_RUN.startingUptime,
    deskBudget: MILESTONE_1_RUN.deskBudget,
    nextEntityId: 1,
    desks: [],
    bugs: [],
    wave: null,
  };
}

export function tick(run: RunState, commands: Command[]): { run: RunState; events: SimEvent[] } {
  if (run.phase === 'victory' || run.phase === 'defeat') return { run, events: [] };

  const next: RunState = {
    ...run,
    bugs: run.bugs.map((b) => ({ ...b })),
    desks: run.desks.map((d) => ({ ...d })),
    wave: run.wave && { ...run.wave, schedule: run.wave.schedule },
  };
  const events: SimEvent[] = [];

  // 1. Apply commands — accepted only while phase === 'build'. Checked per-command, not
  // once before the loop, because StartSprint can flip the phase partway through a batch.
  if (next.phase === 'build') {
    for (const command of commands) {
      if (next.phase !== 'build') break;
      if (command.type === 'StartSprint') {
        if (next.wave !== null) continue;
        const waveDef = next.waves[next.currentWave];
        const built = buildSchedule(waveDef, next.rngState);
        next.rngState = built.rngState;
        next.wave = { schedule: built.schedule, spawned: 0, waveTick: 0 };
        next.phase = 'running';
      } else if (command.type === 'PlaceDesk') {
        const occupied = next.desks.map((d) => ({ x: d.x, y: d.y }));
        if (next.desks.length >= next.deskBudget) continue;
        if (placementError(next.board, occupied, command.x, command.y) !== null) continue;
        next.desks.push(createDesk(next.nextEntityId, { x: command.x, y: command.y }, DEVELOPER));
        next.nextEntityId += 1;
      } else if (command.type === 'RemoveDesk') {
        next.desks = next.desks.filter((d) => d.id !== command.deskId);
      }
    }
  }

  // 2. If running, advance the wave.
  if (next.phase === 'running' && next.wave) {
    const wave = next.wave;
    const waveDef = next.waves[next.currentWave];

    // 2.1 Move
    for (const bug of next.bugs) bug.distance += bug.speed / TICK_RATE;

    // 2.2 Leak
    const leaked = next.bugs
      .filter((b) => b.distance >= pathLength(next.board))
      .sort((a, b) => a.id - b.id);
    for (const bug of leaked) {
      events.push({ type: 'BugLeaked', bugId: bug.id, leakCost: bug.leakCost });
      const lost = Math.min(bug.leakCost, next.uptime);
      next.uptime -= lost;
      events.push({ type: 'UptimeLost', amount: lost, uptime: next.uptime });
      next.bugs = next.bugs.filter((b) => b.id !== bug.id);
    }

    // 2.3 Defeat
    if (next.uptime === 0) {
      next.phase = 'defeat';
      events.push({ type: 'RunOver', outcome: 'defeat', wave: next.currentWave + 1, uptime: 0 });
      next.tick += 1;
      return { run: next, events };
    }

    // 2.4 Spawn
    for (let i = 0; i < wave.schedule.length; i += 1) {
      if (wave.schedule[i] === wave.waveTick) {
        const bug = createBug(next.nextEntityId, waveDef.bug);
        next.nextEntityId += 1;
        next.bugs.push(bug);
        events.push({ type: 'BugSpawned', bugId: bug.id, bugType: bug.type, hp: bug.hp });
        wave.spawned += 1;
      }
    }

    // 2.5 Fire — positions are fixed for the tick (movement already happened), but the
    // candidate list is rebuilt per desk so a bug an earlier desk kills this tick can't
    // still be targeted (and orphan-fired on) by a later one.
    const positions = new Map<EntityId, { x: number; y: number }>();
    for (const bug of next.bugs) positions.set(bug.id, pointAtDistance(next.board, bug.distance));

    for (const desk of next.desks) {
      desk.cooldownRemaining = Math.max(0, desk.cooldownRemaining - 1);
      if (desk.cooldownRemaining > 0) continue;
      const candidates: Positioned[] = next.bugs.map((bug) => ({ bug, ...positions.get(bug.id)! }));
      const target = selectTarget(desk, candidates);
      if (!target) continue;
      events.push({ type: 'DeskFired', deskId: desk.id, targetId: target.id, damage: desk.damage });
      target.hp -= desk.damage;
      events.push({ type: 'BugDamaged', bugId: target.id, deskId: desk.id, damage: desk.damage, hpRemaining: target.hp });
      desk.cooldownRemaining = desk.cooldownTicks;
      if (target.hp <= 0) {
        events.push({ type: 'BugKilled', bugId: target.id, deskId: desk.id });
        next.bugs = next.bugs.filter((b) => b.id !== target.id);
      }
    }

    // 2.6 Advance the wave clock
    wave.waveTick += 1;

    // 2.7 Wave end
    if (wave.spawned === waveDef.count && next.bugs.length === 0) {
      events.push({ type: 'WaveEnded', wave: next.currentWave + 1, uptime: next.uptime });
      next.wave = null;
      if (next.currentWave === next.waves.length - 1) {
        next.phase = 'victory';
        events.push({ type: 'RunOver', outcome: 'victory', wave: next.currentWave + 1, uptime: next.uptime });
      } else {
        next.phase = 'build';
        next.currentWave += 1;
      }
    }
  }

  next.tick += 1;
  return { run: next, events };
}
