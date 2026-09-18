import { createRun, snapshot } from './sim';
import { MILESTONE_1_BOARD } from './content/board';
import { MILESTONE_1_WAVES } from './content/waves';

const root = document.querySelector<HTMLElement>('#root');
if (root) {
  const state = snapshot(createRun(MILESTONE_1_BOARD, MILESTONE_1_WAVES, Date.now() >>> 0));
  root.textContent =
    `Open Floor Plan — sim ready: ${state.waveCount} waves, uptime ${state.uptime}, ` +
    `${state.deskBudget} desks. The renderer arrives with render-diorama.`;
}
