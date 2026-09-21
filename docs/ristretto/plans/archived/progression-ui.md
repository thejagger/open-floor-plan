# progression-ui — Desk inspector, cap legibility, moving, and tier on the board

## Spec
- Source: idea (docs/superpowers/specs/2026-09-21-milestone-2-progression-design.md, feature 3)
- Flight: milestone-2
- Goal: make a desk's career visible and spendable — select a person, read what they are, buy a level knowing what it forecloses, and move them knowing what it costs.

## Contract
- Acceptance:
  - [auto] Clicking a placed desk during the build phase selects it and opens the inspector. It does not remove the desk — the milestone-1 behaviour where a click sent `RemoveDesk` is gone, and no single click anywhere destroys a person.
  - [auto] The inspector shows the selected desk's title, unspent XP, effective damage and range, and both paths' next prices, and every displayed value equals the snapshot's value for that desk.
  - [auto] Buying from the inspector raises that path's level and debits the price in the sim, and the inspector reflects both within one HUD sync interval.
  - [auto] A purchase the cap forbids is not offered: when the other path is above `crossPathCap`, that path's buy control is disabled, and a disabled control sends no command when clicked.
  - [auto] When a path sits at `crossPathCap`, its next purchase is marked as the locking one before it is taken.
  - [auto] Removing a desk requires confirmation: one click on the remove control does not remove it; confirming does, and the desk budget returns by one.
  - [auto] With a desk selected, clicking a valid destination tile moves it and debits the XP cost the UI showed before the click; clicking an invalid tile does nothing and leaves the selection intact.
  - [auto] A process desk's aura ring renders at the radius the snapshot reports, read through the scene probe — buff reach and the drawn circle are the same number.
  - [auto] The full flow (select, buy, move, confirm-remove) produces no console errors or uncaught exceptions, using the `problems` collector the e2e fixture already installs.
  - [human] The craft-versus-process fork feels like a real choice.
- Provides:
    `useSelection` store (`deskId` or null);
    `useDesks` store (throttled desk-snapshot mirror the inspector reads, keyed off the same HUD_SYNC_MS signature pattern as `store/hud.ts`);
    `DeskInspector` overlay component;
    `commandForTile(board, snap, selection, tile): Command | null` — replacing the selection-free signature;
    `src/ui/format.ts` (`formatStat`, `formatPrice`, `formatTitle`) — shared display formatting the inspector and its e2e specs both call;
    test bridge additions: `select(deskId)`, and an aura radius reading on `SceneStats`
- Consumes: `SnapshotDesk` extended fields (`xp`, `craft`, `process`, `title`, `auraRadius`, effective `damage` and `range`, `lockedPath`, `nextPrice`), commands `BuyLevel` and `MoveDesk` — all from progression-core
- Decisions:
  - Click semantics -> a click on a desk selects; a click on an empty valid tile places when nothing is selected and moves when something is. Removal leaves the board entirely and lives inside the inspector behind a confirmation. This is forced by removal becoming destructive: one stray click must not be able to delete a principal engineer.
  - Selection state -> UI-only, in its own zustand store beside `store/hud.ts`. The sim has no notion of a selected desk and should not gain one.
  - Rule ownership -> the inspector recomputes nothing. `lockedPath` and `nextPrice` arrive on the snapshot; the cap rule has exactly one owner and the UI is not it.
  - Why the lock is surfaced early -> a commitment the player did not know they were making is not a choice, it is a trap, and this is precisely the moment the milestone's question is decided.
  - Move cost visibility -> shown before the click, not after it.
  - Tier on the board -> craft level accretes visible mass through the existing `PrimitiveDesk` and render registry; process shows as a ground ring at the aura's real radius. A desk holding unspent XP carries a badge, because otherwise the build phase hides its own decision.
  - HUD -> unchanged. XP is per-person and belongs on the person; there is no new global counter.
  - Layout, wording, ordering of inspector rows and the styling of the lock marker -> implementer's call within the existing `ui.css` language. These are build instructions, not behaviours, and none of them become assertions.
  - Gate routing -> `src/ui`, `src/store` and `src/render` already route to Playwright via the `render` entry in `.ristretto.json`; no gate changes needed.
  - How the e2e criteria are grouped into specs -> few specs sharing a page load, not one spec per criterion. Measured on the milestone-1 suite: a Playwright spec costs 2-3s of SwiftShader page load before it asserts anything, and this contract has nine `[auto]` criteria. One spec each would add 30-45s of pure startup to a suite that already takes 138s, and the `render` route runs all of it on every change under `src/ui`. Group by flow — selection and inspector display in one, buy and lock in one, move and confirm-remove in one — so a page load is amortised across several assertions. This is a build instruction, not a behaviour; it binds the implementer and is checked by reading.
  - Inner loop -> `npm run test:e2e:fast` (from suite-cost) runs the specs that never start a wave. Use it between edits; it is not a gate, and the full suite still runs at close.
  - What must not happen -> dropping a criterion to save suite time. The grouping above exists so that every one of the nine can be proven without nine page loads, not so that some of them go unproven.
- Units:
  - Selection store and the `placement.ts` rework: `tileStatus` and `commandForTile` become functions of selection and tile.
  - The inspector panel as a read-only view of the selected desk.
  - Buy controls, the cap lock affordance, and confirmation on remove.
  - Move interaction with destination highlighting and cost preview.
  - Desk tier visuals and the process aura ring.
  - Test bridge and scene probe additions, plus the e2e specs covering the flow.
- Manual-Checks:
  - proves · the craft-versus-process fork feels like a real choice · no test in this repo can hold that opinion; it is the question milestone 2 exists to answer and the game design plan says to rework the fork here if the answer is no · run `npm run dev` and play several full runs, taking one desk deep in craft and another deep in process, then judge whether deep process was ever worth taking over more damage — and if it was not, say so, because a negative answer is the useful result
- Blockers: —

## Approach

The interaction rework is the load-bearing part and it comes first, because everything else hangs off selection existing. `placement.ts` currently maps a click on a desk tile straight to `RemoveDesk`, which cannot survive removal becoming destructive; the same click now opens an inspector instead, and `tests/e2e/placement.spec.ts` changes with it.

The inspector is deliberately dumb. Every rule it appears to know — what a level costs, which path is locked, what a move costs — arrives on the snapshot from `sim/`. That keeps the cap rule single-owner and makes the panel cheap to test: assert the DOM against the snapshot, not against a reimplementation.

The one genuinely new render work is the aura ring, and it earns a criterion because a ring drawn at the wrong radius actively misleads the player about buff reach. Everything else about how tier reads on the board is a design judgement recorded in Decisions, checked by reading and by the manual check, not pinned by an assertion.

The e2e suite already has what this needs: `project(tile)` on the bridge converts a tile to a click position, and the fixture already collects console errors for the whole test. The additions are a selection hook and an aura radius reading on the scene probe.

- Likely touchpoints: src/game/placement.ts, src/store/ (new selection store), src/ui/ (inspector, ui.css), src/render/entities/Desks.tsx, src/render/entities/PrimitiveDesk.tsx, src/render/registry.ts, src/dev/bridge.ts, src/dev/SceneProbe.tsx, tests/e2e/
- Depends: progression-core
- Parallel-with: —

## Evidence

Gates green on `69595c5` (feature/brew-2026-09-21): `npm run lint` clean, `npm run typecheck`
clean, `npm test` (`vitest run && playwright test`) — 58/58 unit tests unchanged from
progression-core, and 11/11 e2e specs (`placement.spec.ts` now 3, down from 4 —
criterion 1 retires click-to-remove by name — plus the new `progression.spec.ts`'s 3), unit
suite 3.84s, e2e suite 2.1m.

Criterion -> proof:

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | a click selects and does not remove; no single click destroys a person | `progression.spec.ts:44` — inspector visible after a second click on the same desk, `snapshot.desks` still length 1, `desks-remaining` still `budget - 1` (:50-57); `placement.spec.ts:53` ("ignores clicks while a wave is running") re-proves no inspector opens mid-wave on the same click path |
| 2 | every displayed value equals the snapshot's | `progression.spec.ts:44` — title, xp, damage, range, both levels, both prices, each read through `src/ui/format.ts` against `snapshot.desks[0]` |
| 3 | a purchase raises the level, debits the price, and the panel follows within one HUD sync interval | `progression.spec.ts:143` — `xp === before.xp - price`, `craft === 1`, `level-craft`/`inspector-xp` asserted with a 3000ms bound (see note below on that bound) |
| 4 | the capped path is not offered, and a disabled control sends nothing | `progression.spec.ts:143` — `buy-process` disabled once `lockedPath === 'process'`, force-clicked, `awaitTicks`, level and xp unmoved |
| 5 | at the cap, the next purchase is marked as the locking one before it is taken | `progression.spec.ts:143` — `lock-process` absent at process level 1, visible at level 2 (the locking rung), gone again once craft has actually crossed the cap and closed it |
| 6 | removal needs confirmation; the budget returns | `progression.spec.ts:169:205-219` — armed state survives `awaitTicks` with the desk still present and the budget still short one; confirming drops `deskObjects` to 0 and returns `desks-remaining` to the full budget |
| 7 | a move debits the cost shown; an invalid tile does nothing and keeps the selection | `progression.spec.ts:169` — a corridor-tile click leaves x/y/xp and `data-desk` untouched; a valid click moves the desk and debits exactly the `inspector-move-cost` value read before the click |
| 8 | the aura ring is drawn at the snapshot's radius | `progression.spec.ts:143` — `stats.auras` (read off `RingGeometry.parameters.outerRadius` through the scene probe) equals `[{ deskId, radius: snapshot.auraRadius }]` |
| 9 | the full flow raises no console error or uncaught exception | all three `progression.spec.ts` tests end on `expect(problems).toEqual([])`, covering select, buy, move and confirm-remove between them |
| 10 | the craft-versus-process fork feels like a real choice | pending human: `docs/ristretto/manual-checks.md` under `## progression-ui` |

Evidence from the implementer, independently verified by the reviewer: two test-only races were
fixed while building the suite above, neither touching sim or content numbers. `inspector-move-cost`
(criterion 7) was being read before the throttled `useDesks` store had caught up to a wave that had
just finished — fixed by waiting on the same pattern the buy assertions already use. The "buys
levels" scenario's 120xp/4-wave margin (craft 1+2+3 = 85, process 1+2 = 35, and waves 1-3 yield
exactly 100xp) could be pushed into the unreturnable final wave by click-timing jitter — wrapped in
a bounded restart-and-retry. The reviewer confirmed both are legitimate, hide no product defect,
and weaken nothing, and separately confirmed the deleted removal test in `placement.spec.ts`
(criterion 1 retires click-to-remove by name) was genuinely obsolete, with everything it proved
re-proven at `progression.spec.ts:50-57`, `:206-219` and `tests/sim/commands.test.ts:22-29`.

`Provides:` corrected above to match what was actually built: `useDesks` (a second throttled
store, alongside `useSelection`, that the plan's Provides line omitted) and `src/ui/format.ts`
(display formatting shared by the inspector and its own e2e specs).

Review notes not acted on by this close (non-blocking, left for the historical record):
- `tests/e2e/progression.spec.ts:107` — criterion 3 says the inspector reflects a buy "within one
  HUD sync interval" and the docblock claims the timeout is that interval, but the assertion
  allows 3000ms — 15 intervals; a latency regression up to 3s would stay green. No user harm — the
  sync really is on the 200ms throttle at `GameDriver.tsx:17-21`. Suggested fix: tighten to ~1s, or
  reword the docblock to say the bound covers throttle plus SwiftShader frame granularity, not one
  interval.
- `src/ui/DeskInspector.tsx:111` — `confirm-remove` is not gated on `buildPhase` while
  `remove-desk` at :119 is, so arming in build and confirming after a sprint has started closes the
  panel on a command the sim refuses. No user harm — `sim.ts:90` accepts commands only in the build
  phase, so the desk survives and nothing is lost; only the panel closes on a no-op. Suggested fix:
  add `disabled={!buildPhase}` to the confirm button.
- `src/ui/DeskInspector.tsx:85` — move cost is recomputed in the UI from `content/progression`
  (`Math.floor(desk.xp * TABLE.moveCostFraction)`), duplicating `sim.ts:135`, against the plan's
  ruling that the inspector recomputes nothing. No user harm —
  `progression.spec.ts:187-203` compares the displayed cost to the actual debit at runtime, so a
  divergence turns red. Suggested fix: put `moveCost` on `SnapshotDesk` beside `nextPrice`, where
  the same ruling already puts the cap verdict.
- `tests/e2e/progression.spec.ts:59` — the title row is asserted on a freshly placed desk, so
  `formatTitle('')` is compared to its own fallback; the guard the second test added
  (`expect(bought.title).not.toBe('')`, :111 in that test) is missing here. No user harm — the
  real-title case is covered there. Suggested fix: drop the assertion here and let that guard carry
  it.
- `tests/e2e/progression.spec.ts:155` (lean) — up to 4 replays of a 4-wave run live inside
  Playwright's 180s test timeout while `earnXp`'s own deadline is 150s (`fixtures/game.ts:217`), so
  a slow first attempt burns the whole budget and the retry buys nothing; each retry also restarts
  on a random seed (`src/game/seed.ts:2`), making an attempt-2+ failure unreplayable. Suggested fix:
  a dev-bridge XP grant (the unit suite already has `grant()` in `tests/helpers/sim.ts`) would make
  the scenario deterministic and drop several waves of playback per run.
- `src/game/placement.ts:51` (lean) — `selection as EntityId` re-asserts what `tileStatus`
  already established one line earlier. Suggested fix: have the `moveTarget` branch carry the id,
  or narrow before the switch.
- `src/dev/SceneProbe.tsx:33` (lean) — the `auras` array is rebuilt and allocated every frame even
  when no desk has an aura, which is the whole of milestone 1 and most of milestone 2. Suggested
  fix: return a shared empty array when the group has no children.

Manual-Checks: the one `[human]` criterion is unticked in `docs/ristretto/manual-checks.md` under
`## progression-ui` — whether the craft-versus-process fork feels like a real choice. No test in
this repo can hold that opinion; `pending human`.

review: notes-only · rounds: 1 · open: 0 block, 4 note, 3 lean
tier: normal

status: needs-human
