# Open Floor Plan — Technical Design

2026-09-18

Companion to [Open Floor Plan — Game Design Plan](../../Open%20Floor%20Plan%20—%20Game%20Design%20Plan.md). That document defines
*what the game is*. This one defines *how it gets built*: architecture, rendering,
visual staging, and the first milestone.

Where the two disagree, the game design plan wins on design questions and this
document wins on technical ones. One deliberate deviation is recorded under
[Milestone 1](#milestone-1--does-placing-a-desk-and-watching-it-shoot-feel-good).

## Goals

1. A playable browser demo, shareable by link, no install.
2. Abstract low-poly visuals now, staged well enough to read as intentional.
3. A path to a fully-realised visual presentation later that does not require
   rewriting the game.
4. Balance decisions driven by data rather than guesswork.

Goals 2 and 3 are one goal held at two points in time. Every architectural
decision below is chosen so that upgrading the art does not disturb the game.

## Non-goals

- Multiplayer, accounts, persistence, a backend of any kind.
- Mobile-first layout. Desktop browser is the target; mobile is not designed for.
- A level editor or content-authoring tooling.
- Realistic rendering. The target is stylized, and stylized is not a lesser
  version of realistic.

## Technology

| Concern | Choice |
| --- | --- |
| Language | TypeScript, strict |
| Build | Vite |
| Rendering | three.js via `@react-three/fiber` |
| Scene helpers | `@react-three/drei` |
| Postprocessing | `@react-three/postprocessing` |
| UI | React DOM, overlaid on the canvas |
| UI state bridge | zustand |
| Live tuning | leva (development only) |
| Tests | Vitest |

### Why three.js rather than a full engine

Visual ceiling is not set by the renderer. three.js supports glTF with skeletal
animation, PBR materials, image-based lighting, shadow mapping, ACES tone
mapping, bloom, depth of field, SSAO, instancing and LOD. Babylon.js supports
the same set. The difference between a demo and a fully-realised look is assets,
lighting and postprocessing — none of which the library choice constrains.

Low-poly is not the opposite of high-quality. Polished stylized games are
routinely modest in polygon count; the quality comes from texturing, rim
lighting, shallow depth of field and clean silhouettes. The demo is not low-poly
so much as *untextured*, and that is a smaller gap to close than it appears.

Rejected alternatives:

- **Babylon.js** — genuinely stronger batteries-included rendering: the Default
  Rendering Pipeline, a live Inspector, a Node Material Editor. The right pick
  for a rendering-led project. Here, React DOM integration matters more, because
  the UI layer is load-bearing (see the game design plan on the retro screen and
  on merge-conflict readability). Remains a viable fallback.
- **PlayCanvas** — a real visual editor and asset pipeline; valuable for an
  art-led team, overhead for a solo code-led demo.
- **Unity WebGL** — multi-megabyte builds, slow cold start, awkward DOM UI
  story. Directly undermines the "send colleagues a link" premise that motivates
  the project.

Because the simulation is renderer-agnostic (below), replacing the render layer
later is a bounded rewrite against a working, tested sim — not a rewrite of the
game. The decision is reversible, which is why it can be made quickly.

## Architecture

Three layers, with a strictly one-directional dependency:

```
content/  →  sim/  →  render/ + ui/
  (data)     (logic)    (presentation)
```

`sim/` never imports from `render/` or `ui/`. `render/` and `ui/` never mutate
sim state; they read snapshots and consume events, and send commands only
during the build phase.

### The simulation core

A standalone TypeScript module with zero rendering dependencies, deterministic
under a seed.

**Fixed timestep.** The sim advances at 20 ticks per second regardless of
framerate. Without this, balance drifts between machines and headless test
results do not match what players experience.

**Seeded RNG.** A single seeded generator is threaded through the sim. Every
random decision draws from it: Flaky Test's dodge roll, Race Condition's speed
jitter, spawn timing. The same board plus the same seed produces the same wave,
every time.

**Determinism is enabled by a design rule.** The game design plan forbids
intervention once a wave starts. A wave is therefore a pure function of
`(board layout, wave definition, seed)`. This is what makes headless batch
simulation valid, and it is the property the rest of this architecture is built
on.

**Modules:**

| Module | Responsibility |
| --- | --- |
| `rng.ts` | Seeded pseudo-random generator |
| `board.ts` | Grid, path, desk placement, occupancy, validity rules |
| `entities.ts` | Bugs and desks as plain data with numeric IDs |
| `combat.ts` | Targeting, damage application, tier gates, thresholds |
| `progression.ts` | Per-desk XP, craft/process branch, headcount |
| `waves.ts` | Spawn schedules, merge-conflict fusion, boss modifiers |
| `events.ts` | Event type definitions |
| `snapshot.ts` | The read-only state shape the renderer consumes |
| `sim.ts` | `tick()` — the public surface |

Entities are plain data with numeric IDs rather than object graphs. This keeps
snapshots cheap to produce and trivially serializable, which the balance harness
depends on.

**Output of a tick:** a state snapshot plus a list of events —
`BugSpawned`, `DeskFired`, `BugDamaged`, `BugMerged`, `BugKilled`, `LevelUp`,
`UptimeLost`, `WaveEnded`.

The renderer draws snapshots and reacts to events. The retro screen reads the
same event stream, so its commentary derives from what actually happened rather
than being authored separately. The joke and the explosion agree.

### Content as data

`content/` holds the twelve bug definitions, the two upgrade trees, and wave
compositions as plain data tables — no logic. Three consequences:

- Balance changes are edits to a table, not to game code.
- The balance harness can sweep across variants without touching `sim/`.
- The game design plan's instruction to "write them before balancing them" is
  structurally supported: the jokes can be written into the table first and
  given numbers later.

### Enforcing the boundary

`src/sim/` and `src/content/` are covered by an ESLint `no-restricted-imports`
rule banning `three`, `@react-three/*`, and any import from `../render` or
`../ui`.

Architectural boundaries maintained by discipline erode. Boundaries that fail CI
do not. This is a few lines of configuration and it is what keeps the renderer
replaceable.

## The render layer

The renderer is a read-only consumer of simulation state.

**Interpolation, not simulation.** The sim ticks at 20Hz; the browser renders at
60–144Hz. Each frame, `useFrame` interpolates entity transforms between the
previous and current snapshot and writes them **directly to object refs**.

> **Rule, non-negotiable:** nothing that moves every frame goes through React
> state. Per-frame updates are ref writes inside `useFrame`. Violating this is
> the most common cause of poor framerate in react-three-fiber projects, and it
> degrades gradually enough to be hard to diagnose after the fact.

**Visual registry.** Each entity type maps to a component via a lookup table:

```ts
const registry = {
  typo:      PrimitiveBug,
  developer: PrimitiveDesk,
  // later: developer: ModelledDesk
}
```

Upgrading a primitive to a loaded GLB is a one-line change per entity type. Game
logic does not move; the rest of the renderer does not move. This table is the
concrete mechanism behind "abstract now, fully-realised later".

**Instancing.** Typo arrives in dozens and Deprecated Dependency spawns
continuously, so swarm entities render through `InstancedMesh` — one draw call
regardless of count. Built in from the start: retrofitting instancing means
restructuring how entities render.

**Input.** Pointer raycasting for desk placement and drag-and-drop exists only
during the build phase, when nothing is moving and nothing is time-critical.
The no-intervention rule was adopted for feel; it also removes an entire
category of engineering problem.

**UI.** React DOM absolutely positioned above the canvas — trait-style panels,
tooltips, the retro screen, the Start Sprint button. UI reads sim state through
a zustand store **throttled to a few updates per second**. A health bar does not
need 20Hz, and driving React at tick rate is the second common way to lose
framerate.

**VFX from events.** The renderer drains the event queue each frame:
`DeskFired` spawns a tracer, `BugMerged` plays a fusion effect, `UptimeLost`
shakes the camera.

### Merge-conflict readability

The game design plan flags this as load-bearing: if the player cannot see which
bugs are about to fuse, the best mechanic in the game becomes noise. It is
therefore a render-layer requirement with an explicit solution, not something
deferred:

- Proximity highlighting on bugs within fusion range.
- A visible tether between bugs about to fuse.
- A consistent size and colour language for combined HP.

Abstract visuals make this easier rather than harder — the entire visual
vocabulary is owned, and nothing competes for the player's attention.

## Visual staging

Postprocessing over primitives is the cheapest quality-per-effort available and
is enabled from Milestone 1. The same geometry reads as "unfinished" without it
and "deliberately stylized" with it.

**Camera.** The board is a diorama — a small world on a table, not a level the
player is inside. A perspective camera with a narrow FOV (25–35°) placed far
back yields near-parallel lines while retaining some depth. Orbit is constrained
by clamped polar angle: the player may rotate around the floor but never reach
edge-on or top-down. A cutaway office floor plan is a familiar, readable object
and suits this framing well.

**Lighting.** Warm key, cool fill, and a rim light — the rim separates
silhouettes from the background and is a significant part of why stylized characters read
clearly. Plus drei's `<Environment>` for image-based lighting, and
`<ContactShadows>` beneath every object. Missing contact shadows are the most
common tell of an amateur 3D scene.

**Postprocessing** via `<EffectComposer>`:

- **Depth of field** — the strongest single diorama signal. Board sharp,
  background soft.
- **Bloom**, restrained, on emissive materials only.
- **Vignette**, subtle.
- **ACES tone mapping** with correct colour space on the canvas. Omitting this
  is why much WebGL content looks flat and washed out.

**Materials.** `MeshStandardMaterial` with flat colours now. The later upgrade
is textures and tuned roughness; the lighting rig and postprocessing stack carry
over unchanged. The expensive half is built first, and it is the half that does
not require an artist.

**Visual language.** Since abstract shapes carry all the information:

- **Colour = role.** Developer, QA, DevOps and Support each own a hue, used
  consistently in the 3D scene and the UI.
- **Shape = bug archetype.** Swarm is small and numerous; armoured is chunky and
  faceted; stealth is translucent; spawners visibly carry their children. A
  player should identify Legacy Code from silhouette alone, before any tooltip.
- **Emissive = state.** Marked by QA, buffed by a PM, about to merge.

**Tuning.** leva sliders on every light, camera and effect parameter during
development. Finding the look is minutes of dragging rather than dozens of
edit-reload cycles. Final values are frozen into constants.

### Asset pipeline (future)

Not required for the demo. Recorded so the abstract phase does not paint into a
corner:

- **Props** (desks, chairs, monitors, racks, plants) — generated by Blender
  Python scripts. Parametric and re-runnable: change a value, regenerate the set
  consistently.
- **People** — modelled blocky in Blender, auto-rigged and animated via Mixamo.
  This covers the "never made moveable models" gap with a web service rather
  than a skill that must be acquired. Animation needs are small because people
  sit at desks: idle, typing, a gesture.
- **Bugs** — assembled from primitives and animated procedurally in code. No
  rig, no exported animation, no Blender.

Everything loads as glTF/GLB through the visual registry.

## Repository structure

```
open-floor-plan/
├── docs/
│   ├── Open Floor Plan — Game Design Plan.md
│   └── superpowers/specs/
├── src/
│   ├── sim/
│   │   ├── rng.ts
│   │   ├── board.ts
│   │   ├── entities.ts
│   │   ├── combat.ts
│   │   ├── progression.ts
│   │   ├── waves.ts
│   │   ├── events.ts
│   │   ├── snapshot.ts
│   │   └── sim.ts
│   ├── content/
│   │   ├── bugs.ts
│   │   ├── roles.ts
│   │   └── waves.ts
│   ├── render/
│   │   ├── Stage.tsx
│   │   ├── registry.ts
│   │   ├── entities/
│   │   └── vfx/
│   ├── ui/
│   │   ├── Hud.tsx
│   │   ├── BuildPanel.tsx
│   │   └── RetroScreen.tsx
│   ├── store/
│   └── main.tsx
├── tools/
│   └── balance.ts
└── tests/
```

## Testing

**The sim is test-driven.** It is pure, deterministic and fast, which makes TDD
natural rather than dutiful. Tests assert on behaviour that maps directly to the
design: a level-3 craft developer kills a Legacy Code bug before tile 14; two
adjacent bugs fuse with combined HP; a Rounding Error is immune below the damage
threshold.

**The render layer is not unit-tested.** Testing that a cylinder appeared at
coordinates is expensive and asserts nothing about whether the game is good.
Rendering is verified by looking at it.

**The balance harness** (`tools/balance.ts`) runs the sim headless in Node
across many seeds and configurations, emitting distributions rather than single
outcomes. This is how the game design plan's open decisions get settled with
evidence.

## Milestone 1 — "does placing a desk and watching it shoot feel good?"

Mirrors step 1 of the game design plan's build order, with one deviation.

**Deviation from the game design plan:** staging and juice are included in this
milestone rather than deferred. A prototype rendered as untextured boxes with no
hit feedback answers the feel question *incorrectly* — it feels bad for reasons
unrelated to the design. Hit flashes, floating numbers and death pops are the
instrument the question is measured with, not polish applied afterwards.

**In scope:**

- Floor grid with one hand-authored path, rendered as a diorama
- Place a single developer desk on a valid tile, build phase only
- Start Sprint button; no input accepted once a wave runs
- Typo bugs spawn on a schedule and walk the path
- Desk auto-targets, fires; bugs take damage and die
- Bugs reaching Production cost uptime; the counter never refills
- Wave ends, return to build phase
- Full staging: diorama camera, three-point lighting with rim, contact shadows,
  depth of field, bloom, vignette, ACES tone mapping
- Juice: hit flash, floating damage number, death pop, camera shake on uptime
  loss
- Sim headless, deterministic under seed, unit-tested
- ESLint boundary rule active

**Out of scope:** XP, upgrades, the craft/process branch, the other four roles,
the other eleven bug types, merge conflict, bosses, the retro screen, hiring,
headcount.

**Open decisions deferred:** wave length and run length are not needed to answer
the feel question and are settled at Milestone 2 using the balance harness
rather than by estimate.

**Estimate:** the sim and loop are a weekend. Allow several additional days for
first-time three.js staging — largely configuration, but the first
postprocessing chain reliably consumes an afternoon. Approximately one week.
Subsequent milestones are faster because the spine exists.

**Success criterion:** it is enjoyable to place a desk and watch it work. If
not, the design is reworked before anything further is built. This is the
question the milestone exists to answer, and a negative answer is a valid and
useful result.

## Subsequent milestones

Following the game design plan's build order:

2. The developer's two upgrade paths, per-desk XP, the branch choice at
   level-up. Balance harness built here; wave length and run length settled.
3. The remaining four roles, including the PM as a process-path endpoint.
4. All twelve bug types plus the merge-conflict rule.
5. Waves, bosses, and the retro screen.

Each gets its own design pass before implementation.

## Risks

| Risk | Mitigation |
| --- | --- |
| react-three-fiber's model proves annoying | Sim is renderer-agnostic; falling back to vanilla three.js costs the render layer only |
| Per-frame React state creeps in and degrades framerate | Stated as an explicit rule; watch for it in review |
| Abstract visuals make the game unreadable | Colour/shape/emissive language defined up front; merge-conflict readability treated as a requirement |
| Scope expands beyond Milestone 1 | Out-of-scope list is explicit; the milestone answers one question |
| The feel question answers "no" | That is the milestone working as intended, discovered in week one rather than month three |
