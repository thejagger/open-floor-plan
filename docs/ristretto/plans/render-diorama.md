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

status: planned
