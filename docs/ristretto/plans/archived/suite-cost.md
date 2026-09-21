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

## Evidence

Gates green on `d58cd72` (feature/brew-2026-09-21): `npx vitest run` — 27 unit tests passing,
Duration 4.07s (baseline 8.69s), `tests/boundary.test.ts` alone 3480ms (baseline 7,931ms) — one
lint spawn for the whole file, not two.

Criterion -> proof:

| Criterion | Proof |
| --- | --- |
| one lint spawn, still names every probe file and banned specifier | `tests/boundary.test.ts > the renderer-free boundary > npm run lint fails when $path imports the render layer` (`it.each(PROBES)`, 2 cases) — `beforeAll` spawns lint once with both probes planted; each case asserts against `reportFor(output, path)`, the report block for that probe alone, so a probe whose glob fell out of `eslint.config.js` would report nothing and the case would fail |
| unit suite < 6s, 27 tests passing | measured: `npx vitest run` — 27/27 passing, Duration 4.07s (baseline 8.69s); `boundary.test.ts` alone 3480ms (baseline 7,931ms) |
| HUD-per-wave and victory-overlay proven by one five-wave playback, not two | `overlays.spec.ts > tracks the sim in the HUD through five waves, shows the victory overlay, and restarts into a new run`; `hud.spec.ts` deleted |
| exactly two specs play to victory, one to defeat | victory: the merged `overlays.spec.ts` test and `run.spec.ts > plays a full five-wave run with no uncaught exception and no console error`; defeat: `overlays.spec.ts > shows the defeat overlay at uptime 0 and restarts into a new run`; `scene.spec.ts` samples a wave in flight and calls neither `start-sprint` to completion nor `playToEnd` (confirmed by grep across `tests/e2e/*.spec.ts`) |
| every prior assertion still exists | HUD uptime/wave compared against the sim snapshot at each of the five wave boundaries (loop body, `overlays.spec.ts`); uptime shown to move (`expect(seen[seen.length - 1]).toBeLessThan(seen[0])`); victory overlay visible, defeat overlay absent; restart-to-fresh-run assertions (new seed, full uptime, wave 1, no desks) unchanged after the merged test |
| `npm run test:e2e:fast` runs only specs that never start a wave, < 35s | 5 `@fast` tests total — `instancing.spec.ts` (1) and `placement.spec.ts` (4) — the full set of specs that never call `start-sprint`/`playToEnd` |
| `npm run test:e2e` still runs every spec, tagged or not | `package.json`'s `test:e2e` script is unchanged (`playwright test`, no `--grep`); `test:e2e:fast` is a separate, additive script |

Implementer caveat on the `test:e2e:fast` timing criterion: the 5-test fast lane passes in 23.4s
when a dev server is already up (the inner-loop case Playwright's `reuseExistingServer` targets),
but 36.8-41.0s cold, where ~15s is Vite boot plus browser launch that the contract's in-suite
28.5s baseline never included. Recorded, not treated as a failure: the fast lane is an inner-loop
convenience, never a gate — `.ristretto.json` still routes every UI change at the full suite, and
`npm run test:e2e` still runs this test unchanged.

Review notes not acted on by this close (non-blocking, left for the historical record):
- `tests/e2e/placement.spec.ts:67` — `ignores clicks while a wave is running` carries `@fast` but
  does start a wave (clicks start-sprint, polls to phase `running`), so the fast lane's stated
  boundary — "only the specs that never start a wave" — is not literally true. Suggested fix: drop
  the tag from that test, or restate the boundary as "never plays a wave to the end".
- `docs/ristretto/plans/archived/render-diorama.md:90` — the archived proof table still cites
  `hud.spec.ts > shows the sim's uptime after every wave of a full run`, a file and test name this
  diff deletes. Suggested repoint: `overlays.spec.ts > tracks the sim in the HUD through five
  waves, shows the victory overlay, and restarts into a new run`.
- `tests/boundary.test.ts:56` — `expect(status).not.toBe(0)` is a property of the one shared spawn
  but is asserted once per `it.each` row, so both cases re-prove the same exit code. Suggested
  fix: assert it once (its own `it`, or in `beforeAll`).
- `tests/e2e/overlays.spec.ts:42` — the `wave` loop counter is never read in the body and is
  shadowed by the destructured `wave` inside the poll callback two lines down. Suggested fix:
  `for (let i = 0; i < 5; i += 1)`.

review: notes-only · rounds: 1 · open: 0 block, 2 note, 2 lean
tier: easy

status: done
