import { useLayoutEffect, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import * as THREE from 'three';
import { entranceTile, inBounds, isPathTile, productionTile } from '../sim';
import { MILESTONE_1_BOARD } from '../content/board';
import { BOARD_CENTRE, BOARD_H, BOARD_W, FLOOR_Y } from './tuning';
import {
  ENTRANCE_COLOUR, FLOOR_ALT_COLOUR, FLOOR_COLOUR, PATH_COLOUR, PRODUCTION_COLOUR,
} from '../theme';

const dummy = new THREE.Object3D();
const floorColourA = new THREE.Color(FLOOR_COLOUR);
const floorColourB = new THREE.Color(FLOOR_ALT_COLOUR);
const pathColour = new THREE.Color(PATH_COLOUR);

export function Board(): JSX.Element {
  const floorRef = useRef<THREE.InstancedMesh>(null!);
  const pathRef = useRef<THREE.InstancedMesh>(null!);

  const floorTiles = useMemo(() => {
    const tiles: { x: number; y: number }[] = [];
    for (let y = 0; y < BOARD_H; y += 1) {
      for (let x = 0; x < BOARD_W; x += 1) {
        if (inBounds(MILESTONE_1_BOARD, x, y) && !isPathTile(MILESTONE_1_BOARD, x, y)) {
          tiles.push({ x, y });
        }
      }
    }
    return tiles;
  }, []);

  const pathTiles = useMemo(() => MILESTONE_1_BOARD.path, []);

  useLayoutEffect(() => {
    const mesh = floorRef.current;
    floorTiles.forEach((tile, i) => {
      dummy.position.set(tile.x, FLOOR_Y, tile.y);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, (tile.x + tile.y) % 2 === 0 ? floorColourA : floorColourB);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [floorTiles]);

  useLayoutEffect(() => {
    const mesh = pathRef.current;
    pathTiles.forEach((tile, i) => {
      dummy.position.set(tile.x, 0.02, tile.y);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, pathColour);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [pathTiles]);

  const entrance = entranceTile(MILESTONE_1_BOARD);
  const production = productionTile(MILESTONE_1_BOARD);

  return (
    <group name="board">
      <mesh receiveShadow position={[BOARD_CENTRE[0], -0.12, BOARD_CENTRE[2]]}>
        <boxGeometry args={[BOARD_W + 0.6, 0.24, BOARD_H + 0.6]} />
        <meshStandardMaterial color={FLOOR_COLOUR} roughness={0.9} />
      </mesh>

      <instancedMesh name="floor" ref={floorRef} receiveShadow args={[undefined, undefined, floorTiles.length]}>
        <boxGeometry args={[0.92, 0.08, 0.92]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>

      <instancedMesh name="path" ref={pathRef} receiveShadow args={[undefined, undefined, pathTiles.length]}>
        <boxGeometry args={[0.92, 0.08, 0.92]} />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>

      <mesh position={[entrance.x, 0.4, entrance.y]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.32, 0.06, 12, 24]} />
        <meshStandardMaterial
          color={ENTRANCE_COLOUR}
          emissive={ENTRANCE_COLOUR}
          emissiveIntensity={1.4}
        />
      </mesh>

      <mesh castShadow position={[production.x, 0.55, production.y]}>
        <boxGeometry args={[0.8, 1.1, 0.8]} />
        <meshStandardMaterial
          color={PRODUCTION_COLOUR}
          emissive={PRODUCTION_COLOUR}
          emissiveIntensity={1.6}
        />
      </mesh>
    </group>
  );
}
