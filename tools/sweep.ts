import { runHeadless } from './headless';
import { LAYOUT_AXIS } from './layouts';
import type { RunOutcome } from './headless';
import type { RunConfig } from '../src/sim/sim';

export type BalanceConfig = { name: string; config: RunConfig };

export type Distribution = { min: number; p10: number; median: number; max: number };

export type CellReport = {
  config: string;
  layout: string;
  runs: number;
  winRate: number;                 // 0..1
  uptimeRemaining: Distribution;   // median and p10 are the two the contract names
  uptimeLostPerWave: number;
  waveSeconds: Distribution;
  killsPerDeskPerWave: number;
  leaksPerWave: number;
};

export type BalanceReport = { seeds: number[]; cells: CellReport[] };

/** Nearest rank, so every number reported is one some run actually produced. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(p * sorted.length)));
  return sorted[rank - 1];
}

export function distribution(values: readonly number[]): Distribution {
  return {
    min: percentile(values, 0),
    p10: percentile(values, 0.1),
    median: percentile(values, 0.5),
    max: percentile(values, 1),
  };
}

const mean = (xs: readonly number[]) =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

function cell(config: string, layout: string, outcomes: RunOutcome[]): CellReport {
  const waves = outcomes.flatMap((o) => o.waves);
  return {
    config,
    layout,
    runs: outcomes.length,
    winRate: outcomes.filter((o) => o.outcome === 'victory').length / outcomes.length,
    uptimeRemaining: distribution(outcomes.map((o) => o.uptimeRemaining)),
    uptimeLostPerWave: mean(waves.map((w) => w.uptimeLost)),
    waveSeconds: distribution(waves.map((w) => w.seconds)),
    killsPerDeskPerWave: mean(waves.map((w) => w.killsPerDesk)),
    leaksPerWave: mean(waves.map((w) => w.leaks)),
  };
}

export function sweep(configs: BalanceConfig[], seeds: number[]): BalanceReport {
  const cells: CellReport[] = [];
  for (const { name, config } of configs) {
    for (const layout of LAYOUT_AXIS) {
      const outcomes = seeds.map((seed) => runHeadless(config, seed, layout.tilesFor(config, seed)));
      cells.push(cell(name, layout.name, outcomes));
    }
  }
  return { seeds: [...seeds], cells };
}
