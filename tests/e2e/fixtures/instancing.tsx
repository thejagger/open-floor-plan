import { createRoot } from 'react-dom/client';
import { Stage } from '../../../src/render/Stage';
import { stubCtx } from './stubCtx';

const bugs = Number(new URLSearchParams(location.search).get('bugs') ?? '1');
createRoot(document.getElementById('root')!).render(<Stage ctx={stubCtx(bugs)} />);
