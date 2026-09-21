import { tick } from '../../src/sim/sim';
import { snapshot } from '../../src/sim/snapshot';
import type { RunConfig, RunState } from '../../src/sim/sim';
import type { Snapshot } from '../../src/sim/snapshot';
import type { Command } from '../../src/sim/commands';
import type { SimEvent } from '../../src/sim/events';
import type { BoardDef, Tile } from '../../src/sim/board';
import type { BugStats } from '../../src/sim/entities';
import type { WaveDef } from '../../src/sim/waves';
import { DEVELOPER } from '../../src/content/roles';
import { MILESTONE_1_RUN } from '../../src/content/run';
import { MILESTONE_2_PROGRESSION } from '../../src/content/progression';

export const MAX_TEST_TICKS = 20_000;

export type Frame = { tick: number; snapshot: Snapshot; events: SimEvent[] };

/** A `length` x `height` board whose path runs west to east along row 1. */
export function straightBoard(length: number, height = 3): BoardDef {
  const path: Tile[] = [];
  for (let x = 0; x < length; x += 1) path.push({ x, y: 1 });
  return { width: length, height, path };
}

export function bugStats(overrides: Partial<BugStats> = {}): BugStats {
  return { type: 'test-bug', hp: 1, speed: 1, leakCost: 1, xp: 1, ...overrides };
}

export function wave(count: number, overrides: Partial<WaveDef> = {}): WaveDef {
  return {
    bug: bugStats(),
    count,
    spawnIntervalTicks: 10,
    spawnJitterTicks: 0,
    ...overrides,
  };
}

/** The default config with a test board and ladder swapped in. */
export function runConfig(
  board: BoardDef,
  waves: WaveDef[],
  overrides: Partial<RunConfig> = {},
): RunConfig {
  return {
    board,
    waves,
    rules: MILESTONE_1_RUN,
    roles: { [DEVELOPER.role]: DEVELOPER },
    progression: MILESTONE_2_PROGRESSION,
    ...overrides,
  };
}

/** Commands are submitted on the first tick only. */
export function advance(run: RunState, ticks: number, commands: Command[] = []) {
  let current = run;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i += 1) {
    const step = tick(current, i === 0 ? commands : []);
    current = step.run;
    events.push(...step.events);
  }
  return { run: current, events };
}

export function record(
  run: RunState,
  done: (r: RunState) => boolean,
  commandsFor: (r: RunState) => Command[] = () => [],
) {
  let current = run;
  const frames: Frame[] = [];
  while (!done(current)) {
    if (frames.length >= MAX_TEST_TICKS) {
      throw new Error(`record: still not done after ${MAX_TEST_TICKS} ticks (phase ${current.phase})`);
    }
    const step = tick(current, commandsFor(current));
    current = step.run;
    frames.push({ tick: current.tick, snapshot: snapshot(current), events: step.events });
  }
  return { run: current, frames };
}

export const allEvents = (frames: Frame[]): SimEvent[] => frames.flatMap((f) => f.events);
export const terminal = (r: RunState) => r.phase === 'victory' || r.phase === 'defeat';
export const autoSprint = (r: RunState): Command[] =>
  r.phase === 'build' ? [{ type: 'StartSprint' }] : [];
