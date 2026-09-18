# Open Floor Plan — Game Design Plan

2026-09-18 · @Someone

## The pitch

A real-time tower defense set in an office. Bugs walk a path from the entrance toward Production. You place desks beside the path and upgrade the people sitting at them. Waves are sprints: you start each one with a button and cannot intervene once it runs. The health bar is uptime, and it never refills.

What keeps it from being a reskin is that two of the five roles deal no damage at all. QA reveals and marks; the PM buffs neighbours. You cannot win by spamming developers, because half the board is about who sits next to whom.

It is not serious. Every bug type is one joke, and the retro screen between waves is where the writing lives.

**Name: Open Floor Plan.** The map is the joke, it reads as a game title rather than a dev pun, and it survives being said out loud to someone who does not code.

Alternates worth keeping: *Wontfix* (short, memorable, a real bug status), *Blockers* (standup term, and literally what you place), *Five Nines* (uptime as the health bar), *Refactory*.

## Core loop

Straight Bloons rhythm. Real time during a wave, unlimited time between them.

**Build phase.** No timer. Place desks, hire, spend XP, move people. The upcoming wave's composition is visible here, so a loss is always the player's fault. This is also where the retro screen sits: what shipped, what leaked to production, one line of deadpan commentary.

**Wave.** Press Start Sprint. Bugs spawn at the entrance and walk toward Production. Desks fire automatically. **You cannot intervene once it runs** — no mid-wave reassignment, no pause-and-rebuild. You plan the sprint, you commit, you live with it.

**Resolution.** Every bug that reaches Production costs uptime. Uptime never refills. Survivors earn XP, the wave pays headcount, back to the build phase.

Early waves the player presses Start immediately. Later ones they sit and think. That rhythm is the rhythm of the job, and it is why the button beats a pause key: all the deciding happens in the calm gap, by design rather than as a rescue.

## Roles and upgrade paths

Everyone starts as a blank hire. Seniority is not something you buy, it is something a person becomes — which is funnier and truer, and means every tower in the game is one person's career.

Bloons' two-path rule applies: deep on one line, shallow on the other, never both to the top.

**Developer** — the only role that reliably kills things.

- *Craft*: junior → mid → senior → staff → principal. Damage, range, fire rate.
- *Process*: junior → reviewer → mentor → tech lead → PM. Damage falls away, neighbour buffs grow.

Deep craft with a little process is a killer who reviews a bit. Deep process with a little craft is a lead who barely writes code and makes everyone around them twice as good. Same starting person, a real career fork.

This is also why there is no separate PM hire: the PM is what a process-path developer becomes at the top.

**QA** — no damage ever. Reveals invisible bugs and marks them so developers hit harder. Stays a separate hire rather than a developer branch, because revealing is a capability, not a scaling number — if it were an upgrade, Heisenbugs would be unbeatable before the player unlocked it.

- *Detection*: range, marking strength, multi-target marks.
- *Automation*: static coverage on tiles that persists between waves.

**DevOps** — places persistent tiles on the path (traps, monitoring, rate limits) instead of shooting. Its output survives waves, so it rewards planning ahead.

**Support** — sits at the entrance, filters and slows incoming bugs before they reach the floor.

**Freelancer** is not a path, it is a hiring mode: costs headcount, arrives already high-level, leaves after three waves and takes all their XP with them. The correct amount of painful.

## Currencies

Two, and deliberately not three.

**Headcount** — earned per wave survived. Spends on new hires only. Small numbers, hard to get, so adding a person is an event rather than a purchase.

**XP** — earned by each person individually, from their own kills. Spends on that person's upgrades only.

The per-person part is the whole point. A global XP pool would just be budget with a new label. XP that belongs to a specific desk means placement compounds: the developer on the front line becomes a principal engineer while the one parked in the back corner is still a junior in wave 20. Painfully accurate, and it makes a bad desk position hurt every single wave instead of once at purchase.

Support roles need their own XP source or they would never grow:

- QA earns on assists — any bug killed while marked by it.
- PM earns on kills by the desks it buffs. A PM with nobody around it earns nothing, which is the joke.

The split between the two currencies matters because with a single currency the optimal play is always "hire more bodies" and the upgrade tree goes unused. Separating them forces the player to develop the people they already have. It is also the real constraint of the job: you cannot hire, but you can send someone on a course.

**Moving a desk** costs XP, not money — the person loses a chunk of it and a wave of output while they settle into the new team. So layout mistakes are real and there is no free reshuffling every round.

## Bugs

One behaviour each, one joke each, and each mapping to a standard TD archetype so decades of balance knowledge carry over. Write them before balancing them.

| Bug | Behaviour | Archetype |
| --- | --- | --- |
| Typo | Trivial, arrives in dozens | Swarm |
| Off-by-one | Walks exactly one tile further than it should, past your last desk | Range check |
| Memory leak | Gains HP every second it is alive | Kill-order pressure |
| Race condition | Speed fluctuates unpredictably; timing-based desks whiff | Erratic |
| Flaky test | 50% chance to ignore any hit | Dodge |
| Regression | Dies, returns two waves later immune to whatever killed it | Adaptive |
| Heisenbug | Untargetable unless a QA has eyes on it | Stealth |
| Legacy code | Armoured; juniors do nothing, seniors only | Tier gate |
| Deprecated dependency | Spawns smaller bugs continuously as it walks | Spawner |
| Infinite loop | Never leaves; circles its lane forever, occupying space | Blocker |
| Zero-day | Ignores the path entirely, goes straight for Production | Flyer |
| Rounding error | Immune to any hit below a damage threshold | Threshold |

**Merge conflict is a global rule, not a bug type.** Any two bugs that touch fuse into one with combined HP. Half the player's problems become positioning — and occasionally you merge three small ones on purpose to give a senior a single juicy target. Same rule, two opposite plays, no new mechanics.

## Bosses

Every fifth wave is a release. Each boss is a wave modifier plus one big unit, so it changes how the board works rather than just adding HP.

- **The client demo** — bugs are invisible to the player but not to QA.
- **The production outage** — uptime drains passively for the whole wave.
- **The security audit** — every bug that reaches Production costs double.
- **The migration** — the path changes mid-wave.

**Final boss: the Monolith.** Enormous, slow, spawns one of every bug type as it walks, and splits into two smaller monoliths below half health. Beating it is the rewrite. That is the ending.

## Parked

Not cut. Ordered.

**Designer and Architect** — the two best remaining role ideas, and the two hardest to balance. Designer reroutes the path rather than blocking it, which can trivially break a map if the player finds a loop. Architect's damage scales with how well-organised the layout is, which means defining "well-organised" numerically before anyone knows what a good layout looks like. Build them third, once fifty waves have been played.

**Excavation** — the grid starts blocked by the previous tenant (dead cubicles, a server rack nobody turned off, boxes of branded hoodies from a startup that died here). Clearing a tile creates floor space *and* corridors, so every excavation is an economic decision and a maze decision at once. Occasionally a cleared tile yields a legacy service still quietly earning money: keep it for the income or delete it to free the tile. Best idea in the whole design, and an entire second game. Add it after the tower defense is fun on a hand-drawn map.

**Adjacency** — dev beside QA is a tight feedback loop; dev beside PM means meetings, less throughput, controlled scope; anything beside the kitchen is morale up and output down; two dev desks adjacent merge into a squad, more efficient but one bug takes out both. Pairs naturally with excavation, since both are about layout carrying meaning.

**Intern and Consultant** — cut for now. The intern (free, useless, converts to a junior if it survives ten waves) and the consultant (one-time enormous effect, permanently leaves an unbuildable tile) are both structurally odd in ways that make balancing harder, and neither adds much until the core works.

## Build order

Roughly a week each after the first, which is a weekend.

1. **The only question that matters.** One hand-drawn path, one developer desk, one typo bug, a life counter, a Start Sprint button. No upgrades, no XP, no hiring. Does placing a desk and watching it shoot feel good? If not, nothing later fixes it.
2. **The developer's two paths.** Five levels each, with per-person XP and the branch choice at level-up. This is the heart of the game — if the craft-versus-process fork does not feel like a real choice, rework it here before building anything else.
3. **The other four roles.** QA, DevOps, Support, and the PM as a process-path endpoint. Two of them dealing zero damage is the test of whether placement is interesting.
4. **All twelve bugs, plus merge conflict.** Content, but content that needs the combat rules to be final first.
5. **Waves, bosses, and the retro screen.** The retro is where every joke goes, and it is the reason this is worth building rather than admiring.

Step one is a weekend and answers the only thing that cannot be answered by talking. Everything after it is content.

The honest risk here is not ideas, it is the second half. One floor, five roles, twelve bugs, a boss every fifth wave, a win screen. Ship it ugly, then decide whether to excavate.

## Open decisions

**Wave length — settle this first.** Thirty seconds and it is snappy; ninety and every decision carries weight. This single number sets XP rates, damage values, how much text the player will read between waves, and how long a full run takes. Pick it before writing balance code and tune everything against it.

**Web or Flutter.** Web iterates faster and is shareable with a link, which matters for something this jokey — you want to send it to colleagues and have them play it in one click. Flutter with Flame if it should live on a phone.

**Run length.** Fifteen waves with the Monolith at the end is a sitting. Thirty is a campaign. Related to wave length, and worth deciding at the same time.

**Path readability.** With merge conflict as a global rule, the player needs to see at a glance which bugs are about to touch. That is a UI problem, and it is load-bearing — if it is not readable, the best mechanic in the game becomes noise.
