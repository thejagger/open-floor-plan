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
    `DeskInspector` overlay component;
    `commandForTile(board, snap, selection, tile): Command | null` — replacing the selection-free signature;
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

status: planned
