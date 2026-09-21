import { beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { placementError } from '../../src/sim/board';
import { MILESTONE_1_BOARD } from '../../src/content/board';
import { DEFAULT_RUN_CONFIG } from '../../src/content/run';
import { NAMED_LAYOUTS, randomLayout, LAYOUT_AXIS } from '../../tools/layouts';
import { sweep } from '../../tools/sweep';
import { BALANCE_GRID, DEFAULT_OUT_DIR, SWEEP_SEEDS } from '../../tools/balance';
import type { Tile } from '../../src/sim/board';
import type { DeskStats } from '../../src/sim/entities';
import type { BalanceConfig, BalanceReport } from '../../tools/sweep';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const rigged = (
  name: string,
  role: DeskStats,
  startingUptime: number,
): BalanceConfig => ({
  name,
  config: {
    board: MILESTONE_1_BOARD,
    waves: DEFAULT_RUN_CONFIG.waves,
    rules: { startingUptime, deskBudget: 3, defaultRole: 'developer' },
    roles: { developer: role },
    progression: DEFAULT_RUN_CONFIG.progression,
  },
});

describe('the sweep', () => {
  it('reports 0% for a configuration rigged to be unwinnable and 100% for a trivial one', () => {
    // range 100 on both so the verdict is the configuration's, not the layout's
    const unwinnable = rigged(
      'unwinnable',
      { role: 'developer', damage: 0, range: 100, cooldownTicks: 10 },
      1,
    );
    const trivial = rigged(
      'trivial',
      { role: 'developer', damage: 1000, range: 100, cooldownTicks: 1 },
      500,
    );
    const report = sweep([unwinnable, trivial], [1, 2, 3, 4, 5]);
    const cellsFor = (name: string) => report.cells.filter((c) => c.config === name);

    expect(cellsFor('unwinnable')).toHaveLength(LAYOUT_AXIS.length);
    expect(cellsFor('trivial')).toHaveLength(LAYOUT_AXIS.length);
    expect(cellsFor('unwinnable').map((c) => c.winRate)).toEqual(LAYOUT_AXIS.map(() => 0));
    expect(cellsFor('trivial').map((c) => c.winRate)).toEqual(LAYOUT_AXIS.map(() => 1));

    // the distributions move with the input too, not only the headline
    for (const c of cellsFor('unwinnable')) {
      expect(c.uptimeRemaining.median).toBe(0);
      expect(c.leaksPerWave).toBeGreaterThan(0);
    }
    for (const c of cellsFor('trivial')) {
      expect(c.uptimeRemaining.p10).toBe(500);
      expect(c.leaksPerWave).toBe(0);
      expect(c.killsPerDeskPerWave).toBeGreaterThan(0);
    }
  });
});

describe('the layout axis', () => {
  it('places all three named layouts on the default board', () => {
    expect(NAMED_LAYOUTS).toHaveLength(3);
    for (const layout of NAMED_LAYOUTS) {
      expect(layout.tiles).toHaveLength(DEFAULT_RUN_CONFIG.rules.deskBudget);
      const placed: Tile[] = [];
      for (const tile of layout.tiles) {
        expect(
          placementError(MILESTONE_1_BOARD, placed, tile.x, tile.y),
          `${layout.name} (${tile.x},${tile.y})`,
        ).toBeNull();
        placed.push(tile);
      }
    }
  });

  it('samples a placeable random layout that is a function of its seed', () => {
    const a = randomLayout(MILESTONE_1_BOARD, 3, 5);
    const again = randomLayout(MILESTONE_1_BOARD, 3, 5);
    const other = randomLayout(MILESTONE_1_BOARD, 3, 6);

    expect(again).toEqual(a);
    expect(other).not.toEqual(a);
    const placed: Tile[] = [];
    for (const tile of a) {
      expect(placementError(MILESTONE_1_BOARD, placed, tile.x, tile.y)).toBeNull();
      placed.push(tile);
    }
  });
});

describe('npm run balance', () => {
  let status: number | null = null;
  let stdout = '';
  let out = '';

  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'ofp-balance-'));
    const run = spawnSync('npm', ['run', 'balance'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
      env: { ...process.env, BALANCE_OUT: out },
    });
    status = run.status;
    stdout = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  }, 600_000);

  it('sweeps two wave lengths x two run lengths x the three named layouts x 20 seeds', () => {
    expect(status, stdout).toBe(0);
    const intervals = BALANCE_GRID.map((c) => c.config.waves[0].spawnIntervalTicks);
    const waveCounts = BALANCE_GRID.map((c) => c.config.waves.length);
    expect(new Set(intervals).size).toBeGreaterThanOrEqual(2);
    expect(new Set(waveCounts).size).toBeGreaterThanOrEqual(2);
    expect(NAMED_LAYOUTS).toHaveLength(3);
    expect(new Set(SWEEP_SEEDS).size).toBeGreaterThanOrEqual(20);
  });

  it('prints a table and writes a JSON report carrying every metric for every configuration', () => {
    const wrote = /wrote (.+\.json)/.exec(stdout);
    expect(wrote, `no report path in stdout:\n${stdout}`).not.toBeNull();
    const report: BalanceReport = JSON.parse(readFileSync(wrote![1].trim(), 'utf8'));

    expect(report.seeds).toEqual(SWEEP_SEEDS);
    expect(report.cells).toHaveLength(BALANCE_GRID.length * LAYOUT_AXIS.length);
    expect(stdout).toContain('win%');

    for (const cell of report.cells) {
      expect(stdout).toContain(cell.config);
      expect(stdout).toContain(cell.layout);
      expect(cell.runs).toBe(SWEEP_SEEDS.length);
      expect(cell.winRate).toBeGreaterThanOrEqual(0);
      expect(cell.winRate).toBeLessThanOrEqual(1);
      const metrics = {
        uptimeMedian: cell.uptimeRemaining.median,
        uptimeP10: cell.uptimeRemaining.p10,
        uptimeLostPerWave: cell.uptimeLostPerWave,
        waveSeconds: cell.waveSeconds.median,
        killsPerDeskPerWave: cell.killsPerDeskPerWave,
        leaksPerWave: cell.leaksPerWave,
      };
      for (const [metric, value] of Object.entries(metrics)) {
        expect(Number.isFinite(value), `${cell.config}/${cell.layout} ${metric}`).toBe(true);
      }
      expect(cell.waveSeconds.median).toBeGreaterThan(0);
    }
    for (const layout of LAYOUT_AXIS) {
      expect(report.cells.some((c) => c.layout === layout.name)).toBe(true);
    }
  });

  it('writes its default report under a gitignored directory', () => {
    const ignored = readFileSync(resolve(ROOT, '.gitignore'), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim());
    expect(ignored).toContain(`${DEFAULT_OUT_DIR}/`);
  });
});
