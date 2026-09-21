# progression-core — Per-desk XP, the craft/process fork, and the aura model

## Spec
- Source: idea (docs/superpowers/specs/2026-09-21-milestone-2-progression-design.md, feature 2)
- Flight: milestone-2
- Goal: a developer desk becomes a person with a career — their own XP, two upgrade paths with a commitment rule, and a buff aura that makes the damage-free path worth taking.

## Contract
- Acceptance:
  - [auto] A desk earns the bug's XP value for each of its own kills; a desk that kills nothing earns nothing.
  - [auto] A process desk earns `assistFraction` of the XP when a desk inside its aura makes a kill, and earns nothing when no other desk is inside its aura.
  - [auto] Buying a level debits its price and raises that path's level by one. A purchase with insufficient XP is rejected and changes nothing — no partial debit, no level change.
  - [auto] The cap holds in both directions: with craft at 3, process cannot be bought past 2; with process at 3, craft cannot be bought past 2. A desk can reach 5 in one path and 2 in the other, and can never reach 3 in both.
  - [auto] Effective damage is `craft.damage * ownDamageMultiplier * bestAuraMultiplier`, verified on a desk that has both a craft level and a process level while standing inside another desk's aura. Range and fire rate come from craft alone and are unaffected by process level or by any aura.
  - [auto] Auras do not stack: a desk inside two auras takes the stronger multiplier, not the product. Equal multipliers resolve to the lower entity id. A desk is never buffed by its own aura.
  - [auto] `MoveDesk` relocates a desk and charges `floor(xp * moveCostFraction)` from its unspent XP; a desk with zero XP moves free; a move onto an invalid or occupied tile is rejected and changes nothing.
  - [auto] `RemoveDesk` is destructive: the slot returns to the budget, and a desk subsequently placed on any tile starts at level 0 with 0 XP. The removed desk's XP and levels do not survive anywhere in the run state.
  - [auto] `BuyLevel` and `MoveDesk` submitted while a wave is running change nothing, matching how existing commands are already gated to the build phase.
  - [auto] `lockedPath` and `nextPrice` on the snapshot agree with the cap rule at every reachable (craft, process) combination — the UI must never be handed a buyable price for an illegal purchase.
  - [auto] Determinism holds with progression active: the same config, seed and command script run twice produce byte-identical event streams, using the harness check from balance-harness.
- Provides:
    `ProgressionTable`, `Path = 'craft' | 'process'`, `CraftLevel`, `ProcessLevel` from `content/progression.ts`;
    `RunConfig.progression: ProgressionTable`;
    `canBuy(desk: Desk, path: Path, table: ProgressionTable): boolean`;
    `priceOf(path: Path, level: number, table: ProgressionTable): number | null`;
    `titleOf(desk: Desk, table: ProgressionTable): string`;
    `effectiveStats(desk: Desk, desks: readonly Desk[], table: ProgressionTable): DeskStats`;
    commands `BuyLevel { deskId, path }` and `MoveDesk { deskId, x, y }`;
    events `XpGained`, `LevelUp`, `DeskMoved`, `DeskRemoved`;
    `SnapshotDesk` extended with `xp`, `craft`, `process`, `title`, `auraRadius`, effective `damage` and `range`, `lockedPath`, `nextPrice`
- Consumes: `RunConfig`, `createRun(config, seed)`, `runHeadless`, `sweep` — all from balance-harness
- Decisions:
  - The ladder -> level 0 is the blank hire, no bonuses and no title. Five purchasable levels per path. Craft: junior, mid, senior, staff, principal. Process: junior, reviewer, mentor, tech lead, PM.
  - Junior -> level 1 on both paths, not the starting state. The design plan's blank hire is level 0; junior is the first thing you buy, and the fork starts to read at level 2.
  - Title display -> the name of whichever path the desk is deeper in; craft wins a tie; level 0 has no title.
  - The cap rule -> a purchase is legal when the resulting level is at or below `crossPathCap` (2), or when the other path is at or below `crossPathCap`. One rule, stated once, yielding the 5+2 career.
  - Table shape -> craft levels carry absolute stats, process levels carry multipliers. Craft owns what a desk's damage is; process owns what happens to it. This removes the "craft 3 plus process 2" ambiguity that two absolute damage fields would create.
  - Where the table lives -> `content/progression.ts`, so the harness sweeps prices and curves without touching `sim/`.
  - Effective stats -> derived in the fire step each tick, never stored on the desk. Storing buffed values would make the snapshot lie about who the person is and make the result depend on desk iteration order.
  - Aura stacking -> strongest single multiplier, ties to the lower entity id, never self-applied. Keeps the damage math bounded under sweep and keeps the tie deterministic.
  - XP attribution -> the killing desk earns in full; the desk whose aura was applied to that killer at that moment earns `assistFraction`. A process desk with nobody in range earns nothing, which is the joke, and it should be literally true in code.
  - Spending window -> XP accrues during a wave and is spendable only in the build phase. The no-intervention rule is unchanged.
  - Move cost -> `floor(xp * moveCostFraction)` of unspent XP. A desk with no XP moves free; a blank hire has nothing to lose.
  - Why removal turns destructive -> without it, remove-then-place is a free move and the XP cost on `MoveDesk` is decoration. This is a deliberate hardening of milestone-1 behaviour.
  - Settling-in penalty -> out of scope. The design plan's "loses a wave of output" is a second mechanic; the XP cost alone tests whether layout mistakes hurt.
  - Wave and run length -> not a prerequisite. Prices and curves are content and are tuned after balance-harness settles those numbers; nothing in this feature's code waits on them.
- Units:
  - `ProgressionTable` content module and the `progression` field on `RunConfig`.
  - XP accrual and attribution: bug XP values, kill credit, aura assist credit, `XpGained` events.
  - Level purchase: pricing, the cap rule, `canBuy`, `titleOf`, `LevelUp` events.
  - The aura model and `effectiveStats`, wired into the fire step of `tick()`.
  - `MoveDesk`, and `RemoveDesk` turned destructive.
  - Snapshot extensions (`lockedPath`, `nextPrice`, derived stats) and a harness sweep across the price table and both stat curves.
- Manual-Checks: —
- Blockers: —

## Approach

This is the heart of the milestone and almost all of it is pure sim logic, which means it is fully provable headlessly before any pixel depends on its shape. The new module is `sim/progression.ts`, which the technical design already anticipates by name.

The one place this reaches into existing code is the fire step of `tick()`, where effective stats are derived per desk per tick instead of read off the desk record. Keeping base stats on the desk and deriving the rest is what stops the snapshot from lying about who a person is, and it is also what makes the aura order-independent.

The two rules most likely to be got subtly wrong are aura non-stacking and assist attribution, because both are about a relationship between desks rather than a property of one. Both have explicit criteria above, including the tie-break, because a non-deterministic tie would quietly break the determinism guarantee the whole architecture rests on.

Destructive removal is a behaviour change to something milestone 1 shipped as harmless, and the e2e suite touches it. Expect `tests/e2e/placement.spec.ts` to need updating alongside; the interaction rework itself belongs to progression-ui.

- Likely touchpoints: src/sim/progression.ts (new), src/sim/sim.ts, src/sim/commands.ts, src/sim/events.ts, src/sim/entities.ts, src/sim/snapshot.ts, src/sim/index.ts, src/content/progression.ts (new), src/content/bugs.ts, tests/sim/, tools/balance.ts
- Depends: balance-harness
- Parallel-with: —

## Evidence

Gates green on the working tree (feature/brew-2026-09-21): `npm run lint` clean, `npm run
typecheck` clean, `npm test` (`vitest run && playwright test`) 1m39.8s — 58/58 unit tests (11
files, including the 21-test `tests/sim/progression.test.ts` and the new determinism case in
`tests/tools/headless.test.ts`) and 9/9 e2e specs, unchanged per the plan's prediction that
`tests/e2e/placement.spec.ts` needed no edit.

Criterion -> proof:

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | a desk earns the bug's XP for its own kills; a desk that kills nothing earns nothing | `tests/sim/progression.test.ts > XP from kills > credits the killing desk the bug xp in full, and credits a desk that kills nothing nothing` |
| 2 | a process desk earns `assistFraction` on an aura-enabled kill; nothing with no one in its aura | `> XP from an aura > credits the aura owner assistFraction of every kill its aura enabled` and `> credits a process desk nothing while no other desk stands in its aura` |
| 3 | a purchase debits the price and raises the level; an unaffordable purchase is rejected with no partial debit | `> BuyLevel > debits the price and raises that path by one` and `> rejects a purchase the desk cannot afford and changes nothing` |
| 4 | the cross-path cap holds in both directions, 5+2 reachable, never 3+3 | `> the cross-path cap > holds in both directions: past the cap on one path stops the other at the cap` and `> reaches 5 and 2 in either order and never 3 in both, over every purchase order` (BFS over every reachable (craft, process) pair) |
| 5 | effective damage is `craft.damage * ownDamageMultiplier * bestAuraMultiplier`; range/fire rate are craft-only | `> effective stats > multiplies craft damage by its own process multiplier and the aura, and leaves range and fire rate to craft` — asserted both against `effectiveStats` directly and against the `BugDamaged` event the fire step actually emits |
| 6 | auras don't stack, ties resolve to the lower entity id, a desk is never buffed by its own aura | `> auras > applies the stronger multiplier rather than the product when two auras overlap`, `> resolves equal multipliers to the lower entity id whichever order the desks are listed`, `> never buffs a desk with its own aura` |
| 7 | `MoveDesk` relocates and charges `floor(xp * moveCostFraction)`; free at zero XP; invalid/occupied moves rejected; `RemoveDesk` is destructive | `> MoveDesk > relocates the desk and charges floor(xp * moveCostFraction) of its unspent XP`, `> moves a desk with no XP for free`, `> is rejected onto $name and changes nothing` (`it.each`, 4 cases: path tile, off-board, occupied, no-op); `> RemoveDesk > destroys the person: the slot returns, the XP and levels do not` |
| 8 | `BuyLevel`/`MoveDesk` are inert mid-wave, accepted in the build phase | `> spending while a wave runs > ignores BuyLevel and MoveDesk mid-wave and accepts both in the build phase` |
| 9 | `lockedPath`/`nextPrice` on the snapshot agree with the cap rule at every reachable level pair | `> the snapshot cap fields > offers a price exactly where a purchase is accepted, at every reachable level pair` — exhaustive over every `(craft, process)` pair up to the ladder top |
| 10 | determinism holds with progression active | `tests/tools/headless.test.ts > a headless run > replays a run that spends XP into a byte-identical event stream` — same seed, `'craft'` vs `'process'` vs `'none'` spend policies diverge, repeat runs match |

The title rule (a `Decisions:` ruling, not a separate acceptance criterion) is proven by
`tests/sim/progression.test.ts > titleOf > names the deeper path, craft on a tie, and nothing at
all for a blank hire`, asserted against `TABLE.titles` rather than literal strings.

`Provides:` matches what was built exactly — no correction needed. `src/sim/index.ts` re-exports
five extra progression functions (`bestAura`, `auraOf`, `lockedPathOf`, `statsWithAura`, plus
`nextPriceFor`) beyond the four `Provides:` names; that drift is recorded as a lean finding below,
not corrected here since nothing outside `src/sim` imports the extras today.

Implementer correction to the build plan's own test fixture, confirmed independently by the
reviewer: the "XP from an aura" test uses `grant()`, which sets every desk's starting xp to 100
before the wave plays, so the killer's xp at the assertion point is `100 + 24`, not `24`. The
build plan's listed assertion (`expect(run.desks[0].xp).toBe(24)`) would have been red against a
correct implementation; the shipped test reads `expect(run.desks[0].xp).toBe(started.desks[0].xp +
24)` (`tests/sim/progression.test.ts:91`) and still discriminates a mis-attributed kill credit.

Review notes not acted on by this close (non-blocking, left for the historical record):
- `tools/balance.ts:101` — the new `PROGRESSION_GRID` sweep (4 configs x 4 layouts x 10 seeds =
  160 extra full headless runs, ~50% on top of the existing 320) runs on every `npm run balance`,
  which `tests/tools/balance.test.ts:106` spawns as a gate, but nothing asserts its report: the
  regex at `balance.test.ts:127` matches only the first `wrote` line, so emptying the grid or
  breaking the second write leaves the suite green while the gate keeps paying. No user harm — the
  sweep is a developer artefact and no shipped code reads it. Suggested fix: assert the
  progression report (cell count, both spend axes, finite metrics) or gate it behind an env flag.
- `tests/sim/progression.test.ts:324` — the "slot returns to the budget" half of the `RemoveDesk`
  criterion is vacuous here: `deskBudget` is 3 and the test never holds more than one desk, so the
  re-place succeeds whether or not the slot returned. No user harm — `tests/sim/commands.test.ts:
  21-29` already proves the budget return at a full budget. Suggested fix: cite that test and drop
  lines 324-325.
- `tests/sim/progression.test.ts:323` — `JSON.stringify(rehired.desks).not.toContain('"craft":2')`
  narrows "do not survive anywhere in the run state" to the desk array. No user harm — nothing
  outside `desks` stores per-desk xp or levels. Suggested fix: stringify `rehired`.
- `tests/sim/progression.test.ts:143` — "holds in both directions" is fully subsumed by the BFS at
  :151, which already asserts (5,2) and (2,5) reachable and no state with both paths above the
  cap. Suggested fix: drop it.
- `src/sim/index.ts:15` — `bestAura`, `auraOf`, `lockedPathOf`, `statsWithAura` and `priceOf` are
  re-exported from the barrel, but nothing outside `src/sim` imports any of them — tests and
  `tools/headless.ts` import `src/sim/progression` directly. Suggested fix: trim to the four the
  plan's `Provides:` names.
- `src/sim/sim.ts:118-119` — `canBuy` computes the price and discards it, then `nextPriceFor`
  recomputes it with a `!`. Suggested fix: `const price = nextPriceFor(desk, command.path,
  next.progression); if (price === null || desk.xp < price) continue;`.
- `tests/sim/progression.test.ts:325` — `snapshot(rehired).deskBudget === placed.deskBudget` can
  never be red — no command mutates `run.deskBudget`. Suggested fix: drop it.

review: notes-only · rounds: 1 · open: 0 block, 3 note, 4 lean
tier: normal

status: done
