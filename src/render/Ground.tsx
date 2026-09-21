import { useState } from 'react';
import type { JSX } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useGame } from '../game/GameContext';
import { commandForTile, deskAtTile, tileAtPoint } from '../game/placement';
import { selectDesk, useSelection } from '../store/selection';
import type { Tile } from '../sim';
import { MILESTONE_1_BOARD } from '../content/board';
import { BOARD_CENTRE, BOARD_H, BOARD_W, GROUND_Y } from './tuning';
import { HoverPreview } from './HoverPreview';

export function Ground(): JSX.Element {
  const { engine } = useGame();
  const [hover, setHover] = useState<Tile | null>(null); // changes only when the tile changes

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const tile = tileAtPoint(MILESTONE_1_BOARD, e.point.x, e.point.z);
    setHover((prev) => (prev?.x === tile?.x && prev?.y === tile?.y ? prev : tile));
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const tile = tileAtPoint(MILESTONE_1_BOARD, e.point.x, e.point.z);
    if (!tile) return;
    const snap = engine.current;
    // Read, don't subscribe: Ground has no reason to re-render when the selection changes, and
    // the handler always wants the value as of the click.
    const selection = useSelection.getState().deskId;
    const desk = snap.phase === 'build' ? deskAtTile(snap, tile) : null;
    if (desk) {
      selectDesk(desk.id);
      return;
    }
    const command = commandForTile(MILESTONE_1_BOARD, snap, selection, tile);
    if (command) engine.submit(command);
  };

  return (
    <>
      <mesh
        name="ground"
        visible={false}
        rotation-x={-Math.PI / 2}
        position={[BOARD_CENTRE[0], GROUND_Y, BOARD_CENTRE[2]]}
        onPointerMove={onMove}
        onPointerOut={() => setHover(null)}
        onClick={onClick}
      >
        <planeGeometry args={[BOARD_W, BOARD_H]} />
      </mesh>
      <HoverPreview tile={hover} />
    </>
  );
}
