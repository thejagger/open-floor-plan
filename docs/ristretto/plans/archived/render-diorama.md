# render-diorama — Diorama render layer, staging, juice and placement input

## Spec
- Source: idea (Milestone 1 of docs/superpowers/specs/2026-09-18-open-floor-plan-technical-design.md)
- Flight: milestone-1
- Goal: Make sim-core playable and good-looking: a diorama-staged 3D board, desk placement by pointer, a HUD, and the hit feedback the milestone's feel question needs to be answerable.

## Contract
- Acceptance:
  - [auto] Clicking an empty non-path tile during build places a desk, which appears in the snapshot and is drawn in the scene
  - [auto] Clicking a path tile, an occupied tile, or any tile once 3 desks exist places nothing and leaves the snapshot unchanged
  - [auto] Clicking anywhere while a wave is running places nothing and leaves the snapshot unchanged
  - [auto] Clicking an existing desk during build removes it and returns it to the remaining budget
  - [auto] The uptime shown in the HUD equals the sim's uptime after every wave of a full run
  - [auto] The number of bug objects present in the scene equals the number of live bugs in the snapshot
  - [auto] Bug draw calls do not grow with bug count: rendering 25 bugs issues the same number of bug draw calls as rendering 1
  - [auto] Reaching uptime 0 shows the defeat overlay; clearing wave 5 with uptime remaining shows the victory overlay; both offer a restart that begins a new run with a new seed
  - [auto] A full 5-wave run completes with no uncaught exception and no console error
  - [human] The board reads as an intentional, finished diorama rather than an untextured prototype
  - [human] Placing desks and watching a wave resolve is enjoyable, the question Milestone 1 exists to answer
- Provides:
    mountGame(root: HTMLElement, seed: number): void
- Consumes:
    createRun(board: BoardDef, waves: WaveDef[], seed: number): RunState
    tick(run: RunState, commands: Command[]): { run: RunState; events: SimEvent[] }
    snapshot(run: RunState): Snapshot
    Phase, Command, SimEvent
- Decisions:
  - Loop ownership -> one requestAnimationFrame loop accumulates elapsed time and calls tick at a fixed 20Hz, capped at 5 catch-up ticks per frame so a backgrounded tab cannot spiral. Rendering interpolates between the last two snapshots
  - Per-frame rule -> entity transforms are written to object refs inside useFrame. React state is never used for anything that moves. Non-negotiable, per spec
  - UI state bridge -> zustand, throttled to roughly 5Hz. The HUD does not update at tick rate
  - Tile world size -> 1 world unit per tile; board origin at the north-west tile
  - Camera -> perspective, FOV 30, orbit around board centre with polar angle clamped between 35 and 70 degrees, azimuth free, zoom clamped, no panning. Near-isometric with a little depth, per spec
  - Lighting -> warm key, cool fill, rim light for silhouette separation; drei Environment for image-based lighting; ContactShadows beneath every entity
  - Postprocessing -> EffectComposer with DepthOfField, Bloom restricted to emissive materials, and Vignette; ACES tone mapping and correct colour space set on the canvas
  - Bug rendering -> InstancedMesh from the start, since Typo arrives in dozens and retrofitting instancing means restructuring how entities render
  - Performance proof -> asserted as draw-call count invariance rather than a frame-rate threshold. Headless CI renders WebGL through SwiftShader, where an fps number measures the software rasteriser rather than the code; draw calls prove instancing works and are environment-independent. Perceived smoothness is covered by the human feel criterion
  - Visual registry -> entity type maps to component through a lookup table, so swapping a primitive for a GLB later is a one-line change, per spec
  - Colour language -> the developer role owns one hue used identically in the scene and the HUD; path tiles read distinctly from floor tiles; entrance and Production are each marked distinctly
  - Hover preview -> hovering a tile during build shows validity and the desk's range radius before committing. Range is otherwise invisible and is the entire basis of the placement decision
  - Floating damage numbers -> DOM elements positioned from projected world coordinates, so they share the HUD typography rather than needing a separate sprite font
  - Juice set -> hit flash on damage, floating number on damage, scale pop on death, decorative tracer on DeskFired, camera shake on UptimeLost. Driven by draining the sim event queue each frame
  - Restart -> victory and defeat overlays both offer a restart seeding a fresh run, because the feel question is only answerable by playing several layouts in succession
  - Test driver -> Playwright against headless Chromium with SwiftShader enabled for WebGL
  - Out of scope -> trait panels, tooltips, the retro screen, merge-conflict readability affordances. Those arrive with the features that need them
- Units:
  - Stage: canvas, diorama camera rig with clamped orbit, three-point lighting with rim, environment, contact shadows, ACES plus the DepthOfField/Bloom/Vignette chain
  - Board: floor tiles, visually distinct path, entrance and Production markers
  - Entities and interpolation: visual registry, desks as primitives, bugs via InstancedMesh, per-frame interpolation between snapshots through refs
  - Placement input: tile raycasting, hover preview showing validity and range radius, click to place, click to remove, build phase only
  - HUD and overlays: uptime, wave number, desks remaining, Start Sprint button, victory and defeat overlays with restart
  - Juice: hit flash, floating damage numbers, death pop, tracer, camera shake, all driven from the event queue
- Manual-Checks:
  - proves - the board reads as an intentional finished diorama - no test can judge whether staging looks deliberate, and the repo has no path to an aesthetic opinion - play a run and judge whether the lighting, depth of field and colour read as a designed scene or as unfinished primitives
  - proves - placing desks and watching a wave resolve is enjoyable - the milestone success criterion is a subjective judgement with no automatable proxy - play several full runs with different layouts and decide whether to continue to Milestone 2 or rework the core loop
- Blockers: —

## Approach

The renderer is a read-only consumer of sim-core. It never mutates run state; it submits commands during the build phase, reads snapshots, and drains events.

One rAF loop owns time. It accumulates elapsed milliseconds, calls `tick` at a fixed 20Hz with any queued commands, keeps the last two snapshots, and renders an interpolation between them. Capping catch-up ticks stops a backgrounded tab from simulating thousands of ticks on return.

Placement raycasts against a single invisible ground plane and converts the hit point to integer tile coordinates, rather than raycasting against per-tile meshes. Cheaper, and it keeps tile visuals free to change without touching input.

Staging is built in the first unit rather than last. The milestone question cannot be answered by an unstaged scene, and every later unit is judged against how it looks in the finished lighting rig. leva sliders during development, frozen to constants before close.

Juice reads the event queue rather than diffing snapshots. A hit flash belongs to the moment damage was dealt, and events already carry that; diffing would reconstruct information the sim has already stated.

- Likely touchpoints: src/render/, src/ui/, src/store/, src/main.tsx, tests/e2e/, playwright config
- Depends: sim-core
- Parallel-with: —

## Evidence

Gates green on `c459d0e` (feature/brew-2026-09-18): `npm run lint` exit 0; `npx tsc --noEmit`
exit 0; `npm run build` exit 0; `npm test` (vitest run, then playwright test) green — 27 unit
tests plus 10 Playwright e2e specs. `tests/e2e/placement.spec.ts --repeat-each=5` ran 120/120
across 6 stress runs. Full e2e suite wall clock improved from 9.7min to 1.9min over the course
of review.

Criterion -> test proof (per the build plan's map, `.ristretto/build/render-diorama.md`):

| Criterion | Test |
| --- | --- |
| click an empty non-path tile places a desk, in the snapshot and in the scene | `placement.spec.ts > places a desk on an empty non-path tile and draws it` |
| click on path / occupied / past budget places nothing | `placement.spec.ts > places nothing on a path tile, and nothing once the budget is spent`; occupied case reused from `tests/sim/commands.test.ts > PlaceDesk > is rejected on an occupied tile and mutates no state` |
| click during a running wave places nothing | `placement.spec.ts > ignores clicks while a wave is running` |
| click an existing desk removes it and refunds the budget | `placement.spec.ts > removes a desk that is clicked again and returns it to the budget` |
| HUD uptime equals sim uptime after every wave | `hud.spec.ts > shows the sim's uptime after every wave of a full run` |
| bug objects in the scene == live bugs in the snapshot | `scene.spec.ts > draws exactly one bug object per live bug` |
| bug draw calls do not grow with bug count | `instancing.spec.ts > renders 25 bugs in the same number of draw calls as 1` |
| defeat overlay / victory overlay / restart with a new seed | `overlays.spec.ts > shows the defeat overlay at uptime 0 and restarts into a new run`; `> shows the victory overlay after clearing wave 5 and restarts into a new run` |
| full 5-wave run, no uncaught exception, no console error | `run.spec.ts > plays a full five-wave run with no uncaught exception and no console error` |
| catch-up cap (a `Decisions:` ruling, pure, pinned nowhere else) | `tests/game/stepper.test.ts` (2 cases), plus `tests/game/engine-timescale.test.ts` added in review to pin the timeScale fix below |
| the board reads as an intentional finished diorama | confirmed by user manual check, `docs/ristretto/manual-checks.md` check 1, 2026-09-19 |
| placing desks and watching a wave resolve is enjoyable | confirmed by user manual check, `docs/ristretto/manual-checks.md` check 2, 2026-09-19 |

The first implementer was interrupted mid-work; the orchestrator then debugged the failing e2e
suite directly, ahead of review. Defects found and fixed across the whole feature:

1. `src/game/stepper.ts` + `src/game/engine.ts` — the fixed-step catch-up cap was applied to
   time-scaled elapsed, so `timeScale` was silently throttled to ~5 ticks per rendered frame (8x
   short: a 400-tick target delivered 50). The cap is now a real-time budget
   (`MAX_CATCHUP_TICKS * timeScale`); behaviour at timeScale 1 is unchanged, so the hidden-tab
   guard in `tests/game/stepper.test.ts` still passes unmodified. Pinned by the new
   `tests/game/engine-timescale.test.ts`.
2. `src/render/entities/Desks.tsx` — the scene resync was gated on desk *count*, so a tick batch
   holding RemoveDesk(A)+PlaceDesk(B) kept drawing the stale desk permanently. Now keyed on an
   `id:x:y` signature.
3. `tests/e2e/placement.spec.ts` — a whole-object desk comparison flaked on `cooldownRemaining`,
   which legitimately ticks mid-wave; now compares id/role/x/y.
4. `tests/e2e/hud.spec.ts` — waiting for phase `running` became racy once fast-forward actually
   worked; now waits for the wave counter to advance or the run to end.
5. `src/dev/flags.ts` + `src/render/Scene.tsx` — a DEV-only `?fx=off` URL flag skipping
   post-processing, used by the sim-focused e2e specs. `scene.spec` and `instancing.spec`
   deliberately keep effects on. Cannot reach a production build
   (`import.meta.env.DEV` folds to false).
6. `playwright.config.ts` — root cause of a ~1-in-10 intermittent failure that had survived two
   review rounds: the Chromium launch flags `--disable-gpu-vsync --disable-frame-rate-limit` let
   rAF dispatch back-to-back and starve the renderer's ordinary task queue, so React stopped
   committing (HUD DOM frozen while the sim ran) and Playwright's own evaluates stalled up to
   5.7s. Measured A/B: uncapped rAF 73-86/s with timers at 2.9-3.7/s and a worst gap of
   4.2-5.9s (one captured stall hit 28.2s); capped, rAF 8/s, timers 10.0/s, worst gap 129ms.
   Flags removed. Also `trace` now disables screenshots/snapshots, which the same measurements
   showed cost the suite 5-8x its frame rate.

Knock-on edits reviewed and accepted: `run.spec.ts`'s `stats.frame > 200` stall floor
recalibrated to `> 30` for the capped frame rate; `playToEnd`'s Start Sprint click bounded at 2s
and swallowed (the loop's own deadline remains the failure signal).

Coverage note: no e2e test now fast-forwards a full wave with post-processing mounted, so a
defect appearing only under DOF/bloom during a long run would be caught by the manual checks
rather than by the suite.

Reviewer's trailing observation, not a finding: `.ristretto/build/render-diorama.md` still
transcribes `run.spec.ts` as `openGame(page)` with `frame > 200`; the shipped test is
`fx: 'off'` with `> 30`.

Manual-Checks: both `[human]` criteria in `docs/ristretto/manual-checks.md` are now ticked. Neither
has an automatable proxy — the plan records this at the time each check was written (check 1: "no
test in this repo can hold an aesthetic opinion"; check 2: "a subjective judgement with no
automatable proxy" and the milestone's own success criterion) — so no test was added or un-skipped
for either; that would pin an opinion, not prove one. The user played the game and confirmed both
in their own words on 2026-09-19: the board "looks insane" (positively — an intentional, finished
diorama, not unfinished primitives), and placing desks and watching a wave resolve is enjoyable
("i did [play], i love it"). Milestone 1's success criterion is answered YES: continue to
Milestone 2, no core-loop rework needed.

Check re-run: `npm run lint` exit 0, `npx tsc --noEmit` exit 0, `npm run build` exit 0, `npm test`
green (27 unit + 10 Playwright e2e, unchanged from close), `gate.js verify` exit 0 — all unchanged
since `291aebf`, confirming the check re-run needed no code change, only the human signature.

review: resolved · rounds: 3 · open: 0 block, 0 note, 0 lean
tier: normal

status: done
