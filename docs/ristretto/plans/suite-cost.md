# suite-cost — Cut the suite's fixed cost before milestone 2 doubles it

## Spec
- Source: idea (measured audit of the milestone-1 suite, 2026-09-21)
- Flight: —
- Goal: remove duplicated work from the test suite — a second lint spawn and a second full-run playback — and give the e2e suite a fast lane, without losing a single assertion.

## Contract
- Acceptance:
  - [auto] `tests/boundary.test.ts` spawns `npm run lint` exactly once for the whole file, and the run still fails with `no-restricted-imports` naming every probe file and every banned specifier — so dropping either probe's glob from `eslint.config.js` still fails the test.
  - [auto] The unit suite (`npx vitest run`) completes in under 6s on a machine where it currently takes ~8.7s, with all 27 tests still passing. Measured baseline: 8.69s total, 7,931ms of it in `boundary.test.ts`.
  - [auto] The HUD-per-wave assertions and the victory-overlay-and-restart assertions are proven by a single five-wave playback rather than two: after the merge, exactly two e2e specs play a run to victory (the merged one and `run.spec`, which keeps post-processing on and owns the console-error criterion) and one plays a run to defeat.
  - [auto] Every assertion that exists today still exists: the HUD's uptime and wave text is compared against the sim's at all five wave boundaries, uptime is shown to have moved across the run, the victory overlay is visible, the defeat overlay is absent, and restarting yields a fresh run with a different seed, full uptime, wave 1 and no desks.
  - [auto] `npm run test:e2e:fast` runs only the specs that never start a wave, passes, and completes in under 35s. Measured baseline for those specs today: 28.5s of a 138s suite.
  - [auto] `npm run test:e2e` still runs every spec, fast-tagged or not — the tag selects a subset, it never excludes anything from the full run.
- Provides:
    `PROBES: { path: string; banned: string[] }[]` in `tests/boundary.test.ts` — per-probe banned lists proven by one lint spawn;
    `npm run test:e2e:fast`;
    the `@fast` spec tag
- Consumes: —
- Decisions:
  - Why one lint spawn -> the two probes prove the same rule from two directions and each pays a full ESLint startup. Planting both and asserting the output names each probe file keeps the per-probe discrimination: if the `src/content` glob fell out of the config, the combined output would no longer name that file.
  - Why the banned list becomes per-probe -> balance-harness bans `../content` from `src/sim` only, because content must keep importing its own siblings. A shared list cannot express that, and balance-harness builds on this shape.
  - Which specs merge -> `hud.spec.ts` folds into the victory test in `overlays.spec.ts`. Both use the same desk at (4,2), the same `fx=off`, the same 20x time scale and the same five-wave run; the HUD is checked at each wave boundary on the way to the overlay. `hud.spec.ts` is deleted.
  - What does NOT merge -> `run.spec.ts` keeps post-processing on and is the only place combat juice is drawn with EffectComposer mounted, which is the combination it exists to certify. The defeat test drives a different board state (no desks). `scene.spec.ts` samples a wave in flight rather than playing one to the end.
  - What the fast lane is -> a `@fast` tag on the specs that never start a wave (`placement.spec.ts`, `instancing.spec.ts`) and a `--grep @fast` script. It is an inner-loop convenience for `progression-ui`, never a gate: `.ristretto.json` keeps pointing at the full suite.
  - Why now -> `.ristretto.json` routes any change under `src/ui`, `src/store` or `src/render` to the entire Playwright suite, which is the inner loop for all of progression-ui. Four specs each play a complete five-wave run today, 73s of a 138s suite.
  - What this feature must not do -> delete an assertion. Every number above is a cost reduction with the coverage held constant; a criterion that disappears is a regression, not a saving.
- Units:
  - `tests/boundary.test.ts`: per-probe banned lists, both probes planted, one lint spawn, assertions naming each probe file.
  - `hud.spec.ts` folded into the `overlays.spec.ts` victory test; `hud.spec.ts` deleted.
  - `@fast` tags and the `test:e2e:fast` script.
- Manual-Checks: —
- Blockers: —

## Approach

Tier: easy — the contract already names every file, the exact shape each one takes, and the measured baseline each criterion is held against, so a planner would add nothing.

This is a measured audit acted on, not a guess. The suite is 37 tests in ~2.5 minutes, and none of them are junk — there is no arrangement-pinning test in this repo, and every spec carries a comment justifying its cost. What the suite has is duplicated *work*: two lint spawns proving one rule, and four specs each playing a complete five-wave run.

Only two of those four can be collapsed, and the reason the other two cannot is written into the specs themselves — `run.spec` is the only place the post-processing stack is exercised with things dying in front of it, and the defeat run starts from an empty board. Read those comments before touching anything; they are the record of a previous round of exactly this analysis.

The fast lane is deliberately not a gate. `.ristretto.json` keeps routing UI changes at the whole suite, because a UI change really can break any spec; the tag exists so a human iterating on the inspector does not wait on five-wave playbacks between edits.

- Likely touchpoints: tests/boundary.test.ts, tests/e2e/hud.spec.ts (deleted), tests/e2e/overlays.spec.ts, tests/e2e/placement.spec.ts, tests/e2e/instancing.spec.ts, package.json
- Depends: —
- Parallel-with: —

status: planned
