# Manual Checks

Things ristretto had no way to reach. Do one, tick its box, then re-run
the pull to verify what was waiting on it. Never production.

## render-diorama

- [x] **proves** · The board reads as an intentional, finished diorama rather than an untextured prototype · no test in this repo can hold an aesthetic opinion; the technical design states the render layer is not unit-tested and is "verified by looking at it", and a screenshot diff would pin pixels rather than intent · run `npm run dev`, open the game, orbit the board through the full clamped range and judge whether the lighting, depth of field, contact shadows and colour language read as a designed scene or as unfinished primitives
- [x] **proves** · Placing desks and watching a wave resolve is enjoyable, the question Milestone 1 exists to answer · a subjective judgement with no automatable proxy; it is the milestone's success criterion, and the spec says a negative answer is a valid and useful result · run `npm run dev` and play several full runs with different desk layouts and seeds, then decide whether to continue to Milestone 2 or rework the core loop
