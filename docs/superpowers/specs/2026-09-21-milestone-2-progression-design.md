# Open Floor Plan — Milestone 2: Progression and the Balance Harness

2026-09-21

Companion to [Open Floor Plan — Technical Design](2026-09-18-open-floor-plan-technical-design.md)
and to the [Game Design Plan](../../Open%20Floor%20Plan%20—%20Game%20Design%20Plan.md).
This document covers step 2 of the game design plan's build order: the
developer's two upgrade paths, per-desk XP, and the branch choice at level-up —
plus the balance harness the technical design schedules here, and the two open
decisions it exists to settle.

Milestone 1 answered its question: placing a desk and watching it work is
enjoyable, and the core loop needs no rework. This milestone answers the next
one, and it is the harder of the two.

## The question this milestone answers

**Does the craft-versus-process fork feel like a real choice?**

The game design plan is explicit that this is the heart of the game and that a
negative answer is reworked here rather than built past. Two of the five roles
deal no damage at all, and the process path is where that idea is first tested
on a role that *could* have dealt damage instead. If deep process is never worth
taking, the whole second half of the design is in trouble, and this is the
cheapest possible place to find out.

## Goals

1. A developer desk is a person with a career: their own XP, their own levels,
   their own title.
2. Two paths, five levels each, with a commitment rule that makes depth cost
   something.
3. A headless balance harness emitting distributions, so the numbers stop being
   guesses.
4. Wave length and run length settled, with evidence for the measurable half and
   a deliberate judgement for the rest.

## Non-goals

Carried over from the build order, and not negotiable within this milestone:

- **Headcount and hiring.** The desk budget stays fixed. Two currencies exist in
  the design, but a player who can answer weakness by adding a body will never
  explore the tree — which is the exact failure the two-currency split exists to
  prevent. Headcount arrives in milestone 3, where it has more than one thing to
  buy.
- **The other four roles.** QA, DevOps, Support. The PM is not a hire here; it is
  the top of the developer's process path, and that is the only form it takes in
  this milestone.
- **The other eleven bug types, and merge conflict.** Bug content is step 4 and
  needs the combat rules final first. Milestone 2 progresses against Typo alone,
  scaled per wave.
- **Bosses, the retro screen, adjacency, excavation.**
- **The settling-in penalty on a moved desk.** The design plan's "loses a wave of
  output" is a second mechanic layered on the XP cost. The XP cost alone tests
  whether layout mistakes hurt; if it does not, the penalty is a milestone-3
  question.

## Decisions taken

Recorded here so the implementation plans do not relitigate them.

| Decision | Choice | Why |
| --- | --- | --- |
| Milestone shape | Harness first, then mechanics, then UI | The measuring instrument should exist before the thing being measured |
| Currencies | XP only; desk budget fixed | See non-goals |
| Bug content | Typo only, scaled per wave | Build order keeps bug content at step 4 |
| Advancement | Bloons crosspath: buy levels with per-desk XP | The design plan invokes the two-path rule by name; decades of balance knowledge carries over |
| "Neighbour" | Aura radius in tile units | Reuses existing Euclidean range math, survives a sparse three-desk board, leaves the parked Adjacency feature free to be its own system |
| Aura stacking | Strongest single aura, never multiplied | Keeps the damage math bounded under sweep |
| Removing a desk | Destructive — the person and their XP are gone | Otherwise remove-then-place is a free move and the XP cost is decoration |
| Junior | Level 1 on both paths, not the starting state | The design plan's "blank hire" is level 0; junior is the first thing you buy |

## Architecture

No new layer. The dependency direction from the technical design holds:

```
content/  →  sim/  →  render/ + ui/
                ↑
            tools/  (headless, drives tick() directly)
```

`tools/` is a fourth consumer of `sim/`, peer to the render layer and equally
read-only with respect to simulation rules. It does not import from `game/`:
`engine.ts` and `stepper.ts` exist only to reconcile a 20Hz sim with a browser
frame clock, and headless has no frames.

One new sim module, as the technical design anticipates: `sim/progression.ts`.

## Feature 1a — the seam

The sim is not configurable today, and a harness that cannot vary a
configuration is not a harness.

**Inject content instead of importing it.** `createRun(board, waves, seed)` reads
`MILESTONE_1_RUN` from `content/`, and `tick()` imports `DEVELOPER` directly to
build a desk on `PlaceDesk`. Both become one value carried on `RunState`:

```ts
export type RunConfig = {
  board: BoardDef;
  waves: WaveDef[];
  rules: RunRules;
  roles: Record<string, DeskStats>;
};

export function createRun(config: RunConfig, seed: number): RunState;
```

Feature 2 adds one more field, `progression: ProgressionTable`. It is not
declared early: a config field nothing reads is a promise the next feature may
not want to keep.

`content/` keeps exporting a default config; `engine.ts` and `tests/helpers/sim.ts`
pass that, and the harness passes variants. `tick()` resolves desk stats from the
run's own role table and imports nothing from `content/`.

**Make the inversion unrepeatable.** The ESLint `no-restricted-imports` rule on
`src/sim/` already bans `three`, `@react-three/*`, `../render` and `../ui`. Add
`../content`. The technical design's arrow is data flowing content into sim; an
import in the other direction is how that erodes, and it already had.

**Wire `tools/` into the toolchain.** New top-level directory, so: `tsconfig`
include, ESLint coverage, and a `testChanged` route in `.ristretto.json`.
`tools/**` currently matches no route, and that should be a deliberate mapping
rather than an accident.

Behaviour is unchanged by this feature. The existing suites are the proof, and
should pass untouched except where they construct a run.

## Feature 1b — the harness

`tools/balance.ts`, run as `npm run balance`, driving `tick()` in a bare loop
until the run reaches `victory` or `defeat`.

**Axes swept.** Wave length (`spawnIntervalTicks` times `count`), run length
(number of waves), and the difficulty ramp between them. Held fixed: the
milestone-1 board, three desks, Typo.

**Layouts are an axis too.** Three hand-authored named layouts — spread along the
path, clustered at the entrance, clustered at Production — plus a seeded
random-layout sampler, so no configuration is judged on one lucky arrangement.

**Metrics, per configuration, as a distribution across N seeds** rather than a
single outcome:

| Metric | Why it is collected |
| --- | --- |
| Win rate | The headline: is this configuration survivable |
| Median and p10 uptime remaining | Whether the run is tense or merely long |
| Uptime lost per wave | Where in the run the difficulty actually bites |
| Wave duration in seconds | The number being settled |
| Bugs killed per desk per wave | The XP rate the entire progression curve is priced against |
| Leaks per wave | Distinguishes "lost by a little, repeatedly" from "collapsed at wave 9" |

Output is a table to stdout and JSON to a gitignored directory, so a sweep can be
diffed against a later one.

**It also guards determinism.** The same seed run twice must produce an identical
event-stream hash. That property is what the technical design says the whole
architecture rests on, and nothing currently checks it across a full run.

**One honest limit.** The harness cannot decide whether thirty seconds is snappy
or ninety is weighty. It produces the consequences of each choice — total run
duration, decisions per minute, XP per desk per wave — and the judgement is made
by playing it. That judgement is recorded as a manual check in
`docs/ristretto/manual-checks.md`, the same way milestone 1 handled its
subjective criterion, and the settled numbers are then committed into `content/`.

**One new dependency:** `tsx`, as a devDependency, to run a TypeScript CLI.
Node's built-in type stripping is still experimental and the harness should not
be hung on it.

## Feature 2 — progression-core

### The ladder

Level 0 is the blank hire: no bonuses, no title. Each path has five purchasable
levels, carrying the design plan's names.

| Level | Craft | Process |
| --- | --- | --- |
| 0 | *(blank hire)* | *(blank hire)* |
| 1 | junior | junior |
| 2 | mid | reviewer |
| 3 | senior | mentor |
| 4 | staff | tech lead |
| 5 | principal | PM |

Junior means the same thing on either path; the fork starts to read at level 2.
A desk's displayed title is the name of whichever path it is deeper in, and the
craft name on a tie.

### The cap

A desk holds `craft: 0..5` and `process: 0..5`. A purchase is legal when the
resulting level is at or below `crossPathCap` (2), or when the *other* path is at
or below `crossPathCap`. That single rule yields the 5+2 career the design plan
describes: deep on one line, shallow on the other, never both to the top.

### Content tables

Prices and stats live in `content/progression.ts` so the harness sweeps them
without touching `sim/`. Levels carry absolute stats rather than deltas — easier
to read in a table, and no accumulated-rounding surprises.

```ts
export type Path = 'craft' | 'process';

export type CraftLevel   = { price: number; damage: number; range: number; cooldownTicks: number };
export type ProcessLevel = { price: number; ownDamageMultiplier: number; auraRadius: number; auraMultiplier: number };

export type ProgressionTable = {
  craft: CraftLevel[];      // index 0 describes level 1
  process: ProcessLevel[];
  crossPathCap: number;     // 2
  moveCostFraction: number;
  assistFraction: number;
  titles: { craft: string[]; process: string[] };
};
```

Craft levels carry absolute stats; process levels carry multipliers. That split
is deliberate and removes the obvious ambiguity: craft owns what a desk's damage
*is*, process owns what happens to it. Craft raises damage, range and fire rate.
Process lowers the desk's own damage through `ownDamageMultiplier` and grows the
aura — radius and multiplier both.

### Effective stats

Base stats stay on the desk; effective stats are derived in the fire step of each
tick. Storing buffed values would make the snapshot lie about who the person is
and would make the result depend on desk iteration order.

For each desk: start from its craft level's stats (or the role's base at level
0), multiply damage by its own process level's `ownDamageMultiplier`, then
multiply again by the strongest `auraMultiplier` reaching it from another desk.
Range and fire rate come from craft alone. Auras do not stack; the strongest
multiplier wins, ties broken by lowest entity id so the choice is deterministic.
A desk never buffs itself.

### XP

`BugStats` gains an `xp` value. On a kill, the killing desk earns it in full, and
the desk whose aura was applied to that killer at that moment earns
`assistFraction` of it. That is the design plan's rule made literal: a process
desk with nobody in range earns nothing, which is the joke.

XP accrues during a wave and is spendable only in the build phase. Nothing about
the no-intervention rule changes.

### Moving and removing

`MoveDesk { deskId, x, y }` costs `floor(xp * moveCostFraction)`, charged from
the desk's unspent XP. A desk with no XP moves free — a blank hire has nothing to
lose, which is both correct and funny.

`RemoveDesk` becomes destructive: the slot returns to the budget, the person and
all their XP and levels do not. Harsher than milestone 1, and required — without
it, remove-then-place is a free move.

### Surface changes

| Surface | Addition |
| --- | --- |
| Commands | `BuyLevel { deskId, path }`, `MoveDesk { deskId, x, y }` |
| Events | `XpGained { deskId, amount, total, source }` where source is a kill or an assist; `LevelUp { deskId, path, level, title }`; `DeskMoved { deskId, x, y, xpSpent }`; `DeskRemoved { deskId, xpLost }` |
| `SnapshotDesk` | `xp`, `craft`, `process`, `title`, `auraRadius`, effective `damage` and `range`, `lockedPath` (a path or null), `nextPrice` per path (a price or null when unbuyable) |

`lockedPath` and `nextPrice` are computed in `sim/` and carried on the snapshot.
The cap rule has exactly one owner, and the UI is not it.

## Feature 3 — progression-ui

**Selection replaces removal-on-click.** `placement.ts` currently maps a click on
a desk tile straight to `RemoveDesk`. That cannot survive removal becoming
destructive. Clicking a desk in the build phase selects it; removal becomes an
explicit, confirmed button inside the inspector. Selection is UI state — a desk
id or nothing — in its own zustand store, and `commandForTile` becomes a function
of selection *and* tile.

**The inspector** reads entirely from the snapshot: title, unspent XP, both paths
as level rows with prices and buy buttons, effective damage and range, aura
radius. It recomputes no rules.

**The cap is shown before it bites.** When a path sits at `crossPathCap`, its next
purchase is marked as the locking one and the other path's rows show what is
about to be foreclosed. A commitment the player did not know they were making is
not a choice, it is a trap — and this is precisely the moment the milestone's
question is decided.

**Moving.** With a desk selected, valid destination tiles highlight and the XP
cost is shown before the click, not after it.

**Reading tier on the board.** Craft level accretes visible mass on the desk
through the existing `PrimitiveDesk` and render registry. Process shows as a
ground ring at the aura's real radius, so buff reach and range are the same
object the player reasons about. A desk holding unspent XP carries a badge —
otherwise the build phase hides its own decision.

**HUD is unchanged.** XP is per-person and belongs on the person; there is no new
global counter.

## Testing

| Layer | Covered by | What it proves |
| --- | --- | --- |
| `sim/progression.ts` | `tests/sim/progression.test.ts` | Pricing, cap enforcement at the 2/3 boundary, XP attribution to killer and aura, aura non-stacking and its tie-break, move cost, destructive removal |
| `sim/sim.ts` | extensions to `tests/sim/run.test.ts` | Effective stats derived per tick, level purchases rejected outside the build phase |
| `tools/balance.ts` | `tests/tools/balance.test.ts` | A known configuration produces a known distribution; the same seed twice produces an identical event hash |
| `ui/` and `render/` | Playwright specs via the existing dev bridge | Inspector opens on select, a purchase moves the level and debits XP, the cap greys the other path, a move charges XP, removal requires confirmation |
| Feel | `docs/ristretto/manual-checks.md` | Wave length and run length judgement; and whether the fork is a real choice |

The `render` route in `.ristretto.json` already points `src/ui`, `src/store` and
`src/render` at Playwright, so the UI work gates itself. `tools/**` needs the new
route described in feature 1a.

## Open decisions settled here

**Wave length.** The harness reports duration, decisions per minute and XP per
desk per wave for each candidate. The choice among them is made by playing the
candidates and recorded as a manual check. Everything downstream — XP rates,
prices, damage values — is then tuned against the settled number, per the game
design plan's instruction to pick it first.

**Run length.** Same method. The harness gives win-rate curves against wave count
and shows where the difficulty actually bites; the sitting-versus-campaign call
is a judgement made with those curves in hand.

Both are committed into `content/` once settled, and both are re-checked at
milestone 4 when there are twelve bug types rather than one.

## Risks

| Risk | Mitigation |
| --- | --- |
| The fork is not a real choice — process is never worth taking | This is the milestone's question, not a surprise. The harness measures the crossover; the manual check makes the call; the design plan says rework it here |
| Tuning against one bug type produces numbers that do not survive milestone 4 | Accepted deliberately. The harness is the durable artifact; the numbers are explicitly re-checked when bug content lands |
| Aura math makes per-tick cost scale with the square of the desk count | Three desks this milestone. If it matters later, the aura map is computed once per tick rather than per desk-target pair |
| Destructive removal feels punitive before players understand it | It is confirmed, and the inspector shows what is lost. If it reads as cruel rather than consequential, that is a finding, not a defect |
| Scope creeps toward headcount or a second bug type | Non-goals are explicit, and each is justified by the build order rather than by taste |

## Sequencing

Three features, in order, each a roadmap row with its own plan — the same rhythm
milestone 1 ran as `sim-core` then `render-diorama`.

1. `balance-harness` — the seam, the harness, wave and run length settled.
2. `progression-core` — XP, the two paths, the cap, the aura, move and removal.
3. `progression-ui` — inspector, cap legibility, moving, tier on the board.

Progression is fully testable headlessly before any pixel depends on its shape,
and the instrument is standing before the curve it measures exists.
