import { useState } from 'react';
import type { JSX } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../game/GameContext';
import { tileStatus } from '../game/placement';
import type { Snapshot, Tile } from '../sim';
import { MILESTONE_1_BOARD } from '../content/board';
import { DEVELOPER } from '../content/roles';
import { FLOOR_Y } from './tuning';
import { INVALID_COLOUR, VALID_COLOUR } from '../theme';
import { PrimitiveDesk } from './entities/PrimitiveDesk';

type Preview = { tile: Tile; valid: boolean } | null;

function computePreview(snap: Snapshot, tile: Tile | null): Preview {
  if (!tile || snap.phase !== 'build') return null;
  const status = tileStatus(MILESTONE_1_BOARD, snap, tile);
  if (status === 'removable') return null;
  return { tile, valid: status === 'placeable' };
}

const samePreview = (a: Preview, b: Preview): boolean => (
  a === b || (a !== null && b !== null && a.tile.x === b.tile.x && a.tile.y === b.tile.y && a.valid === b.valid)
);

export function HoverPreview({ tile }: { tile: Tile | null }): JSX.Element | null {
  const { engine } = useGame();
  // Re-evaluated every frame, like Desks: a click that places or removes a desk without the
  // pointer crossing to another tile still changes what this tile's status is, and reading
  // `engine.current` only during React's own render (gated on the `tile` prop changing) would
  // leave a stale ghost — still green, say — drawn over the desk that click just placed.
  const [preview, setPreview] = useState<Preview>(() => computePreview(engine.current, tile));
  useFrame(() => {
    const next = computePreview(engine.current, tile);
    setPreview((prev) => (samePreview(prev, next) ? prev : next));
  });

  if (!preview) return null;
  const tint = preview.valid ? VALID_COLOUR : INVALID_COLOUR;

  return (
    <group>
      <PrimitiveDesk x={preview.tile.x} y={preview.tile.y} role="developer" opacity={0.35} tint={tint} />
      <mesh rotation-x={-Math.PI / 2} position={[preview.tile.x, FLOOR_Y + 0.06, preview.tile.y]}>
        <ringGeometry args={[DEVELOPER.range - 0.06, DEVELOPER.range, 64]} />
        <meshBasicMaterial transparent opacity={0.4} color={tint} />
      </mesh>
    </group>
  );
}
