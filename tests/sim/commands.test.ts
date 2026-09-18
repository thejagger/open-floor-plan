import { describe, expect, it } from 'vitest';
import { createRun, tick } from '../../src/sim/sim';
import { MILESTONE_1_RUN } from '../../src/content/run';
import { advance, bugStats, straightBoard, wave } from '../helpers/sim';
import type { Command } from '../../src/sim/commands';

const fullBudget: Command[] = Array.from(
  { length: MILESTONE_1_RUN.deskBudget },
  (_, i) => ({ type: 'PlaceDesk', x: i * 2, y: 0 }),
);

const cases: { name: string; setup: Command[]; rejected: Command }[] = [
  { name: 'a path tile', setup: [], rejected: { type: 'PlaceDesk', x: 3, y: 1 } },
  { name: 'a tile west of the board', setup: [], rejected: { type: 'PlaceDesk', x: -1, y: 0 } },
  { name: 'a tile east of the board', setup: [], rejected: { type: 'PlaceDesk', x: 12, y: 0 } },
  {
    name: 'an occupied tile',
    setup: [{ type: 'PlaceDesk', x: 4, y: 0 }],
    rejected: { type: 'PlaceDesk', x: 4, y: 0 },
  },
  { name: 'one desk past the budget', setup: fullBudget, rejected: { type: 'PlaceDesk', x: 8, y: 0 } },
];

describe('PlaceDesk', () => {
  it.each(cases)('is rejected on $name and mutates no state', ({ setup, rejected }) => {
    const base = tick(createRun(straightBoard(12), [wave(1)], 1), setup).run;
    expect(base.desks).toHaveLength(setup.length);

    const quiet = tick(base, []);
    const noisy = tick(base, [rejected]);

    expect(noisy.run).toEqual(quiet.run);
    expect(noisy.events).toEqual(quiet.events);
    expect(noisy.run.desks).toHaveLength(setup.length);
  });
});

describe('a command submitted while a wave runs', () => {
  it('is rejected and mutates no state', () => {
    const run0 = createRun(straightBoard(12), [wave(3, { bug: bugStats({ hp: 100 }) })], 4);
    const built = tick(run0, [{ type: 'PlaceDesk', x: 2, y: 0 }, { type: 'StartSprint' }]).run;
    const running = advance(built, 30).run;
    expect(running.phase).toBe('running');

    const before = structuredClone(running);
    const quiet = tick(running, []);
    const noisy = tick(running, [
      { type: 'PlaceDesk', x: 5, y: 0 },
      { type: 'RemoveDesk', deskId: running.desks[0].id },
      { type: 'StartSprint' },
    ]);

    expect(noisy.run).toEqual(quiet.run);
    expect(noisy.events).toEqual(quiet.events);
    expect(running).toEqual(before); // tick mutated nothing it was handed
  });
});
