import { createRun, snapshot, tick } from '../sim';
import type { Command, EntityId, Snapshot, SimEvent } from '../sim';
import { DEFAULT_RUN_CONFIG } from '../content/run';
import { MAX_CATCHUP_TICKS, stepsFor, TICK_MS } from './stepper';

export type Engine = {
  readonly seed: number;
  previous: Snapshot;
  current: Snapshot;
  /** bug positions from `previous`, keyed by id, rebuilt once per tick — not once per frame. */
  previousById: Map<EntityId, { x: number; y: number }>;
  /** every bug position seen since the last drain, so juice can place an effect for a bug the
   *  sim has already removed. Cleared by `drainVfx`. */
  lastSeen: Map<EntityId, { x: number; y: number }>;
  alpha: number; // 0..1 interpolation factor into `current`
  events: SimEvent[]; // appended each tick, emptied by the vfx drain
  timeScale: number; // 1 in the game; raised by the e2e bridge
  submit(command: Command): void;
  advance(elapsedMs: number): void;
};

export function createEngine(seed: number): Engine {
  let run = createRun(DEFAULT_RUN_CONFIG, seed);
  const initial = snapshot(run);
  let pending: Command[] = [];
  let accumulator = 0;

  const engine: Engine = {
    seed,
    previous: initial,
    current: initial,
    previousById: new Map(),
    lastSeen: new Map(),
    alpha: 0,
    events: [],
    timeScale: 1,
    submit(command) {
      pending.push(command);
    },
    advance(elapsedMs) {
      // The catch-up cap is a real-time budget, so it scales with the fast-forward:
      // without this, timeScale above a few frames' worth of ticks is silently ignored.
      const stepped = stepsFor(
        accumulator,
        elapsedMs * engine.timeScale,
        MAX_CATCHUP_TICKS * engine.timeScale,
      );
      accumulator = stepped.accumulatorMs;
      for (let i = 0; i < stepped.steps; i += 1) {
        for (const bug of engine.current.bugs) engine.lastSeen.set(bug.id, { x: bug.x, y: bug.y });
        const batch = pending;
        pending = [];
        const step = tick(run, batch);
        run = step.run;
        for (const event of step.events) engine.events.push(event);
        engine.previous = engine.current;
        engine.previousById = new Map(engine.previous.bugs.map((b) => [b.id, { x: b.x, y: b.y }]));
        engine.current = snapshot(run);
      }
      engine.alpha = accumulator / TICK_MS;
    },
  };
  return engine;
}
