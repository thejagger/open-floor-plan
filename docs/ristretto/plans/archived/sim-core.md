# sim-core — Headless deterministic simulation core

## Spec
- Source: idea (Milestone 1 of docs/superpowers/specs/2026-09-18-open-floor-plan-technical-design.md)
- Flight: milestone-1
- Goal: A renderer-free, deterministic tower-defense simulation running a 5-wave Typo ladder against up to 3 developer desks, plus the project scaffold and the lint boundary that keeps it renderer-free.

## Contract
- Acceptance:
  - [auto] The same board, seed and command sequence produce an identical event stream across two independent runs
  - [auto] Advancing a run by N ticks yields identical state regardless of wall-clock time between calls
  - [auto] A Typo reaching Production emits BugLeaked and UptimeLost and reduces uptime by its leak cost; uptime never increases at any point in a run
  - [auto] Uptime reaching 0 puts the run in phase defeat and emits RunOver; no further wave can start
  - [auto] Clearing wave 5 with uptime above 0 puts the run in phase victory and emits RunOver
  - [auto] A desk damages a bug only when that bug is within its range and its cooldown has elapsed; a bug outside range is never damaged
  - [auto] With several bugs in range, a desk targets the one furthest along the path; equal progress resolves to the lowest entity ID
  - [auto] Any command submitted while phase is running is rejected and mutates no state
  - [auto] PlaceDesk is rejected and mutates no state when the target tile is path, out of bounds, or occupied, or when 3 desks already exist
  - [auto] A wave ends only once every spawned bug is dead or has leaked, and phase returns to build
  - [auto] npm run lint fails when any file under src/sim/ or src/content/ imports three, @react-three/*, ../render or ../ui
- Provides:
    createRun(board: BoardDef, waves: WaveDef[], seed: number): RunState
    tick(run: RunState, commands: Command[]): { run: RunState; events: SimEvent[] }
    snapshot(run: RunState): Snapshot
    type Phase = 'build' | 'running' | 'victory' | 'defeat'
    type Command = PlaceDesk | RemoveDesk | StartSprint
    type SimEvent = BugSpawned | BugDamaged | BugKilled | BugLeaked | DeskFired | UptimeLost | WaveEnded | RunOver
- Consumes: —
- Decisions:
  - Tick rate -> fixed 20 ticks/sec, independent of wall clock (spec)
  - Randomness -> single seeded generator threaded through the sim (spec)
  - Entity representation -> plain data with numeric IDs, no object graphs (spec)
  - Content location -> bug/role/wave tables live in src/content/, not src/sim/ (spec)
  - Boundary enforcement -> ESLint no-restricted-imports bans three, @react-three/*, ../render, ../ui inside src/sim/ and src/content/ (spec)
  - Toolchain -> Vite, TypeScript strict, Vitest (spec)
  - Path model -> fixed hand-authored route; desks sit beside the path and do not alter it; no maze-building (game design plan)
  - Milestone scope -> one path, one desk type, Typo only, uptime counter. No XP, upgrades, branches, other roles, other bugs, merge conflict, bosses, retro screen, hiring (spec)
  - Grid geometry -> square grid, integer (x,y) tile coordinates, 4-neighbour adjacency. Chosen over hex because the office theme is rectilinear and the parked Excavation/Adjacency mechanics assume it; the TFT resemblance comes from staging, not board shape
  - Targeting -> first-along-path: the in-range bug furthest toward Production, ties broken by lowest entity ID so replays stay reproducible. Known future interaction: Infinite Loop circles forever and could soak shots permanently under this rule, revisit at Milestone 4
  - Hit model -> instant hit, damage applies on the firing tick. No projectile entities. DeskFired carries deskId, targetId and damage; the renderer draws a purely decorative tracer
  - Desk budget (Milestone 1 only) -> one desk type, hardcoded cap of 3 instances, no currency and no hiring. Overrides the game design plan's "one developer desk" for step 1: a single desk leaves no layout decision, so the prototype would answer a narrower question than the milestone exists to ask
  - Run shape (Milestone 1 only) -> 5-wave ladder. Uptime starts at 20, floors at 0, never refills. Escalating Typo counts, placeholder 5 / 8 / 12 / 18 / 25. Uptime 0 enters defeat; clearing wave 5 enters victory; both emit RunOver with the outcome
  - Tile validity -> a desk may occupy any in-bounds tile that is not path and not already occupied. No adjacency requirement: range already punishes a badly placed desk, and free placement keeps the layout decision two-dimensional
  - Desk repositioning (Milestone 1 only) -> RemoveDesk is free between waves and returns the desk to the budget. The design plan's XP cost for moving arrives at Milestone 2 with XP; charging for it now would price a decision in a currency that does not exist
  - Range shape -> Euclidean radius measured in tile units from desk centre. Chebyshev would make diagonal reach exceed orthogonal reach, which reads wrong against a square grid rendered as a floor
  - Board (Milestone 1 only) -> 12x9 tiles, entrance on the west edge, Production on the east edge, a single S-shaped route authored as an ordered tile list in src/content/. Placeholder for the balance harness
  - Placeholder combat values -> desk: damage 1, range 2.5 tiles, cooldown 10 ticks. Typo: hp 2, speed 1.5 tiles/sec, leak cost 1. All to be replaced by Milestone 2's harness
- Units:
  - Scaffold and lint boundary: Vite, TypeScript strict, Vitest, src/sim and src/content, ESLint no-restricted-imports, lint and test scripts green
  - RNG and board: seeded generator, BoardDef with grid dimensions, ordered path tile list and Production tile, tile validity and occupancy
  - Entities and waves: wave tables in content/, Typo spawning on schedule, movement along the path, leak at Production
  - Combat: range test, cooldown, first-along-path targeting, damage application, death
  - Run loop: phase machine, command validation and rejection during running, uptime, RunOver, snapshot and event emission
- Manual-Checks: —
- Blockers: —

## Approach

Build the scaffold first so the lint boundary exists before there is anything to leak across it; the boundary is cheap on day one and expensive to retrofit once imports have spread.

The sim is a pure function of state and commands. `tick` takes the current run plus any commands and returns the next run plus the events that happened, mutating nothing. Commands are validated inside `tick` rather than at the call site, so the no-intervention-during-a-wave rule is enforced in one place and provable by a single test rather than trusted across a UI.

Entities are parallel arrays or flat records keyed by numeric ID, never nested objects, so a snapshot is cheap to produce every tick and trivially serialisable for the Milestone 2 balance harness.

Bug movement is progress along the path expressed as a scalar distance, not tile-by-tile hops. That makes first-along-path targeting a single numeric comparison, makes movement smooth for the renderer to interpolate, and makes Off-by-one at Milestone 4 a matter of overshooting a number rather than a special case in the grid walk.

All tuning values live in `src/content/` as plain tables. Nothing in `src/sim/` contains a balance number.

- Likely touchpoints: src/sim/, src/content/, tests/, eslint config, vite config, package.json
- Depends: —
- Parallel-with: —

## Evidence

Gates green on `ce4b4bd` (feature/brew-2026-09-18): `npm run lint` exit 0 (eslint .,
no errors); `npx tsc --noEmit` exit 0; `npm test` (vitest run) 23/23 passed across 6 files
(tests/sim/board.test.ts, tests/sim/waves.test.ts, tests/sim/commands.test.ts,
tests/sim/combat.test.ts, tests/sim/run.test.ts, tests/boundary.test.ts).

Criterion → test proof (unchanged from the build plan's map, `.ristretto/build/sim-core.md`):

| Criterion | Test |
| --- | --- |
| identical event stream across two runs | `determinism > replays the same board, seed and commands` |
| N ticks independent of wall clock | `determinism > advances by N ticks identically` |
| leak emits BugLeaked + UptimeLost, costs leak cost | `a bug that reaches Production` |
| uptime never increases | `uptime > never increases at any point in a run` |
| uptime 0 → defeat, RunOver, no further wave | `the end of a run > enters defeat at uptime 0` |
| clearing wave 5 → victory, RunOver | `the end of a run > enters victory after clearing the fifth wave` |
| damages only in range | `a desk out of range` |
| damages only when cooldown elapsed | `a desk in range` |
| targets furthest along path | `targeting > shoots the bug furthest along the path`, plus round-2 addition `targeting > selects the bug further along the path even when it has the higher entity id` |
| ties → lowest entity id | `targeting > resolves equal progress to the lowest entity id` |
| command during running rejected, no mutation | `a command submitted while a wave runs`, plus round-2 addition `a command submitted while a wave runs > rejects commands queued after StartSprint in the same batch` |
| PlaceDesk rejected: path / bounds / occupied / budget | `PlaceDesk > is rejected on $name` (5 cases, budget case reworked in round 2 to also prove RemoveDesk reopens the budget) |
| wave ends only when all spawned bugs resolved | `a wave > ends only once every spawned bug has resolved` |
| lint fails on renderer imports in sim/ and content/ | `the renderer-free boundary` (2 cases) |

Round-2 fixer changes beyond new tests: dropped dead exports `BUGS`/`ROLES` (not part of the
contract's `Provides:`), collapsed `rng.ts` to a single `nextInt` (removed unused
`nextUint32`/`nextFloat`), simplified the eslint `render`/`ui` glob patterns, dropped the
unused `seed` field and `wave.resolved` counter from `RunState`, and made command processing
break out of the batch loop the instant `StartSprint` flips phase to `running` so any command
queued after it in the same `tick()` call is rejected too — closing a gap the round-1 review
found in the no-intervention-during-running rule. `.gitignore` now excludes
`__boundary_probe__.ts` leftovers from a killed boundary test run.

Manual-Checks: none — matches the contract's `Manual-Checks: —`.

review: resolved · rounds: 2 · open: 0 block, 0 note, 0 lean
tier: normal

status: done
