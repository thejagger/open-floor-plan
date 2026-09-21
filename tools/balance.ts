import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sweep } from './sweep';
import { DEFAULT_RUN_CONFIG } from '../src/content/run';
import { TYPO } from '../src/content/bugs';
import type { BalanceConfig, BalanceReport } from './sweep';
import type { WaveDef } from '../src/sim/waves';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Gitignored: a sweep is an artefact to diff against a later one, not a tracked file. */
export const DEFAULT_OUT_DIR = '.balance';

export const SWEEP_SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i);

/** Wave length is spawn interval x count; held apart from run length so the table separates them. */
const WAVE_LENGTHS = [
  { name: 'tight', spawnIntervalTicks: 8 },
  { name: 'loose', spawnIntervalTicks: 16 },
];
const RUN_LENGTHS = [
  { name: 'sitting', waveCount: 5 },
  { name: 'campaign', waveCount: 8 },
];

const ladder = (waveCount: number, spawnIntervalTicks: number): WaveDef[] =>
  Array.from({ length: waveCount }, (_, i) => ({
    bug: TYPO,
    count: 5 + 4 * i,
    spawnIntervalTicks,
    spawnJitterTicks: 4,
  }));

export const BALANCE_GRID: BalanceConfig[] = RUN_LENGTHS.flatMap((run) =>
  WAVE_LENGTHS.map((length) => ({
    name: `${run.name}/${length.name}`,
    config: { ...DEFAULT_RUN_CONFIG, waves: ladder(run.waveCount, length.spawnIntervalTicks) },
  })),
);

type BalanceReportCell = BalanceReport['cells'][number];

function formatTable(report: BalanceReport): string[] {
  const cols: { header: string; width: number; value: (c: BalanceReportCell) => string }[] = [
    { header: 'config', width: 16, value: (c) => c.config },
    { header: 'layout', width: 11, value: (c) => c.layout },
    { header: 'win%', width: 6, value: (c) => (c.winRate * 100).toFixed(1) },
    { header: 'up p50', width: 7, value: (c) => c.uptimeRemaining.median.toFixed(2) },
    { header: 'up p10', width: 7, value: (c) => c.uptimeRemaining.p10.toFixed(2) },
    { header: 'lost/wave', width: 10, value: (c) => c.uptimeLostPerWave.toFixed(2) },
    { header: 'wave s', width: 7, value: (c) => c.waveSeconds.median.toFixed(2) },
    { header: 'kills/desk/wave', width: 16, value: (c) => c.killsPerDeskPerWave.toFixed(2) },
    { header: 'leaks/wave', width: 10, value: (c) => c.leaksPerWave.toFixed(2) },
  ];
  const header = cols.map((col) => col.header.padEnd(col.width)).join(' ');
  const rows = report.cells.map((cell) =>
    cols
      .map((col, i) => (i < 2 ? col.value(cell).padEnd(col.width) : col.value(cell).padStart(col.width)))
      .join(' '),
  );
  return [header, ...rows];
}

export function main(log: (line: string) => void = console.log): string {
  const report = sweep(BALANCE_GRID, SWEEP_SEEDS);
  for (const line of formatTable(report)) log(line);
  const dir = resolve(ROOT, process.env.BALANCE_OUT ?? DEFAULT_OUT_DIR);
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, `balance-${new Date().toISOString().replaceAll(/[:.]/g, '-')}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  log(`wrote ${path}`);
  return path;
}

// Run only as a CLI: importing this module for BALANCE_GRID must not sweep.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
