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

status: planned
