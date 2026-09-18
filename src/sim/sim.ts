import { pathLength } from './board';
import type { BoardDef } from './board';
import type { Command } from './commands';
import { createBug } from './entities';
import type { Bug, Desk, EntityId } from './entities';
import type { SimEvent } from './events';
import { createRng } from './rng';
import type { RngState } from './rng';
import { buildSchedule } from './waves';
import type { WaveDef } from './waves';
import { MILESTONE_1_RUN } from '../content/run';

export const TICK_RATE = 20;

export type Phase = 'build' | 'running' | 'victory' | 'defeat';
export type RunRules = { startingUptime: number; deskBudget: number };

export type WaveRuntime = { schedule: number[]; spawned: number; resolved: number; waveTick: number };

export type RunState = {
  board: BoardDef;
  waves: WaveDef[];
  seed: number;
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
    seed,
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

  // 1. Apply commands — accepted only while phase === 'build'.
  if (next.phase === 'build') {
    for (const command of commands) {
      if (command.type === 'StartSprint') {
        if (next.wave !== null) continue;
        const waveDef = next.waves[next.currentWave];
        const built = buildSchedule(waveDef, next.rngState);
        next.rngState = built.rngState;
        next.wave = { schedule: built.schedule, spawned: 0, resolved: 0, waveTick: 0 };
        next.phase = 'running';
      }
      // PlaceDesk / RemoveDesk arrive in unit 4.
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
      wave.resolved += 1;
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

    // 2.6 Advance the wave clock
    wave.waveTick += 1;

    // 2.7 Wave end
    if (wave.spawned === waveDef.count && next.bugs.length === 0) {
      events.push({ type: 'WaveEnded', wave: next.currentWave + 1, uptime: next.uptime });
      next.phase = 'build';
      next.currentWave += 1;
      next.wave = null;
    }
  }

  next.tick += 1;
  return { run: next, events };
}
