import { createRoot } from 'react-dom/client';
import { Game } from './Game';
import './ui/ui.css';

export function mountGame(root: HTMLElement, seed: number): void {
  createRoot(root).render(<Game seed={seed} />);
}
