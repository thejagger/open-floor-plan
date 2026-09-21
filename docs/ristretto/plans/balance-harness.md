# balance-harness — Configurable sim seam and the headless balance harness

## Spec
- Source: idea (docs/superpowers/specs/2026-09-21-milestone-2-progression-design.md, features 1a and 1b)
- Flight: milestone-2
- Goal: make a run fully described by an injected config, then sweep configs headlessly to produce distributions that settle wave length and run length.

## Contract
- Acceptance:
  - [auto] A run built from a non-default `RunConfig` honours it: role stats and run rules come from the config, not from `content/` defaults — a role table with damage 5 one-shots a 5hp bug, and `startingUptime: 7` starts the run at 7.
  - [auto] `src/sim/**` cannot import `src/content/**`: a probe file in `src/sim` importing `../content/roles` fails `npm run lint` with `no-restricted-imports`, while a probe in `src/content` importing a sibling content module lints clean. Extends the existing `tests/boundary.test.ts` probe pair rather than adding a new mechanism.
  - [auto] The renderer-free boundary already enforced by `tests/boundary.test.ts` (three, @react-three, ../render, ../ui) stays green for both probes; no new work, must not regress.
  - [auto] Determinism across a full run: the same config and seed, run twice to a terminal phase, produce byte-identical event streams.
  - [auto] `npm run balance` completes a sweep over at least two wave-length candidates x two run-length candidates x the three named layouts x 20 seeds, prints a table to stdout and writes a JSON report, with every metric below present for every configuration: win rate, median and p10 uptime remaining, uptime lost per wave, wave duration in seconds, bugs killed per desk per wave, leaks per wave.
  - [auto] The harness discriminates: a configuration rigged to be unwinnable reports a 0% win rate and one rigged to be trivial reports 100%. A harness that reports the same distribution regardless of input is worse than no harness, and nothing else in this contract would catch it.
  - [human] Wave length and run length are settled, and the chosen values recorded.
- Provides:
    `RunConfig = { board: BoardDef; waves: WaveDef[]; rules: RunRules; roles: Record<string, DeskStats> }`;
    `createRun(config: RunConfig, seed: number): RunState`;
    `DEFAULT_RUN_CONFIG: RunConfig` from `content/`;
    `runHeadless(config: RunConfig, seed: number, layout: Tile[]): RunOutcome`;
    `sweep(configs: BalanceConfig[], seeds: number[]): BalanceReport`;
    `npm run balance`
- Consumes: —
- Decisions:
  - Where the harness lives -> `tools/`, a fourth consumer of `sim/`, importing `sim/` and `content/` only. It never imports `src/game/`: `engine.ts` and `stepper.ts` reconcile a 20Hz sim with a browser frame clock, and headless has no frames.
  - Running a TypeScript CLI -> `tsx` as a devDependency. Node's built-in type stripping is still experimental and the harness should not be hung on it.
  - `RunConfig` field count -> four fields in this feature. `progression` is added by progression-core; a config field nothing reads is a promise the next feature may not want to keep.
  - ESLint shape -> the single `src/sim/**` + `src/content/**` block splits in two, because banning `../content` across both would stop content importing its own siblings. Same rule object, two file globs, one extra pattern on the sim half.
  - Boundary probe shape -> the banned list becomes per-probe rather than shared, for the same reason.
  - Layout axis -> three hand-authored named layouts (spread along the path, clustered at the entrance, clustered at Production) plus a seeded random sampler, so no configuration is judged on one lucky arrangement.
  - Report output -> stdout table plus JSON under a gitignored directory, so one sweep can be diffed against a later one. The directory is added to `.gitignore` in this feature.
  - Gate routing -> `tools/**` currently matches no `testChanged` route in `.ristretto.json` and gets one here, pointing at the vitest unit route.
  - Relationship to progression-core -> the settled wave and run length values are deliberately NOT a prerequisite for progression-core. That feature prices XP against a content table that is tunable afterwards, so no downstream feature waits on a human judgement.
  - What the harness cannot do -> it cannot decide whether thirty seconds is snappy or ninety is weighty. It produces the consequences of each candidate; the judgement is the `[human]` criterion.
- Units:
  - The seam: `RunConfig` threaded through `createRun` and `tick`, desk stats resolved from the run's own role table, `engine.ts` and `tests/helpers/sim.ts` updated to pass a config.
  - The boundary: ESLint block split, `../content` banned from `src/sim`, `tests/boundary.test.ts` extended to a per-probe banned list.
  - The headless driver: `runHeadless` looping `tick()` to a terminal phase, collecting per-wave metrics and an event-stream hash.
  - The sweep: config grid, the three named layouts plus the random sampler, distributions across seeds, the metric set.
  - The CLI: `npm run balance`, `tsx` devDependency, JSON output directory gitignored, `tools/**` gate route, `tsconfig` include.
- Manual-Checks:
  - proves · wave length and run length are settled · the harness produces the consequences of each candidate but cannot hold an opinion about whether a wave feels snappy or weighty, and no test in this repo can either · run `npm run balance`, read the duration and XP-rate columns for the candidates, then play the top two or three with `npm run dev` and choose; record the chosen wave length and run length in this plan's Decisions and commit them into `content/`
- Blockers: —

## Approach

The sim is not configurable today: `createRun` reads `MILESTONE_1_RUN` from `content/` and `tick()` imports `DEVELOPER` directly to build a desk on `PlaceDesk`. A harness that cannot vary a configuration is not a harness, so the seam comes first and is pure refactor — the existing suites are its proof and should pass untouched except where they construct a run.

The boundary work is small but worth doing here rather than later: the technical design's arrow is data flowing content into sim, the import already went the other way, and the repo already owns a mechanism (`tests/boundary.test.ts`) that fails lint on a planted probe. Extending it costs a per-probe banned list.

The harness itself is an ordinary Node program: build a config, loop `tick()` until victory or defeat, accumulate metrics, repeat across seeds and configurations. The discriminating criterion matters more than it looks — a harness whose numbers do not move with its inputs is the one failure mode that would poison every balance decision downstream, and it is invisible to every other check here.

- Likely touchpoints: src/sim/sim.ts, src/content/, src/game/engine.ts, tests/helpers/sim.ts, tests/boundary.test.ts, eslint.config.js, tools/ (new), package.json, tsconfig.json, .ristretto.json, .gitignore
- Depends: —
- Parallel-with: —

status: planned
