import { mountGame } from './mountGame';

const root = document.querySelector<HTMLElement>('#root');
const requested = new URLSearchParams(location.search).get('seed');
const seed = requested !== null && Number.isFinite(Number(requested))
  ? Number(requested) >>> 0
  : Date.now() >>> 0;
if (root) mountGame(root, seed);
