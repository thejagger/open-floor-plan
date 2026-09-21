import { createHash } from 'node:crypto';
import { createRun, tick, TICK_RATE } from '../src/sim/sim';
import type { RunConfig } from '../src/sim/sim';
import type { Tile } from '../src/sim/board';
import type { Command } from '../src/sim/commands';
import type { SimEvent } from '../src/sim/events';

/** A config that has not reached victory or defeat by here is malformed, not merely slow. */
export const MAX_HEADLESS_TICKS = 100_000;

export type WaveMetrics = {
  wave: number;             // 1-based, matching WaveEnded
  ticks: number;
  seconds: number;
  uptimeLost: number;
  uptimeRemaining: number;  // at the end of this wave
  leaks: number;
  kills: number;
  killsPerDesk: number;
};

export type RunOutcome = {
  outcome: 'victory' | 'defeat';
  wavesCleared: number;     // WaveEnded events seen
  desksPlaced: number;      // what the layout actually got onto the board
  ticks: number;
  seconds: number;
  uptimeRemaining: number;
  waves: WaveMetrics[];     // one per wave reached, including the one a defeat cut short
  eventCount: number;
  eventHash: string;
};

/** Key-sorted so the hash is a property of the event's content, not of its literal's key order. */
const serialise = (event: SimEvent): string =>
  JSON.stringify(Object.entries(event).sort(([a], [b]) => a.localeCompare(b)));

export function runHeadless(config: RunConfig, seed: number, layout: readonly Tile[]): RunOutcome {
  let run = createRun(config, seed);
  const hash = createHash('sha256');
  let placed = false;
  let waveTicks = 0;
  let waveKills = 0;
  let waveLeaks = 0;
  let waveLost = 0;
  let totalTicks = 0;
  let eventCount = 0;
  let cleared = 0;
  const waves: WaveMetrics[] = [];

  const flush = (wave: number, uptimeRemaining: number) => {
    waves.push({
      wave,
      ticks: waveTicks,
      seconds: waveTicks / TICK_RATE,
      uptimeLost: waveLost,
      uptimeRemaining,
      leaks: waveLeaks,
      kills: waveKills,
      killsPerDesk: run.desks.length === 0 ? 0 : waveKills / run.desks.length,
    });
    waveTicks = 0;
    waveKills = 0;
    waveLeaks = 0;
    waveLost = 0;
  };

  while (run.phase !== 'victory' && run.phase !== 'defeat') {
    if (totalTicks >= MAX_HEADLESS_TICKS) {
      throw new Error(
        `runHeadless: no terminal phase after ${MAX_HEADLESS_TICKS} ticks (phase ${run.phase}, wave ${run.currentWave + 1})`,
      );
    }

    let commands: Command[] = [];
    if (run.phase === 'build') {
      if (placed) {
        commands = [{ type: 'StartSprint' }];
      } else {
        placed = true;
        commands = [
          ...layout.map((tile): Command => ({ type: 'PlaceDesk', x: tile.x, y: tile.y })),
          { type: 'StartSprint' },
        ];
      }
    }

    const inWave = run.wave !== null;
    const step = tick(run, commands);
    run = step.run;
    totalTicks += 1;
    if (inWave || run.wave !== null) waveTicks += 1;

    for (const event of step.events) {
      eventCount += 1;
      hash.update(serialise(event));
      if (event.type === 'BugKilled') waveKills += 1;
      else if (event.type === 'BugLeaked') waveLeaks += 1;
      else if (event.type === 'UptimeLost') waveLost += event.amount;
      else if (event.type === 'WaveEnded') {
        cleared += 1;
        flush(event.wave, event.uptime);
      } else if (event.type === 'RunOver' && event.outcome === 'defeat') {
        flush(event.wave, event.uptime);
      }
    }
  }

  return {
    outcome: run.phase === 'victory' ? 'victory' : 'defeat',
    wavesCleared: cleared,
    desksPlaced: run.desks.length,
    ticks: totalTicks,
    seconds: totalTicks / TICK_RATE,
    uptimeRemaining: run.uptime,
    waves,
    eventCount,
    eventHash: hash.digest('hex'),
  };
}
