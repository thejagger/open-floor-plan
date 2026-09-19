import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { installBridge, clearBridge } from './bridge';
import type { SceneStats } from './bridge';
import { projectTile } from './projectTile';

const ZERO_STATS: SceneStats = { frame: 0, drawCalls: 0, bugInstances: 0, bugsLive: 0, deskObjects: 0 };

let stats: SceneStats = ZERO_STATS;

export function SceneProbe({ bugsLive }: { bugsLive: () => number }): null {
  const { gl, scene, camera, size } = useThree();

  // `stats` is module scope so it survives outside React's render, but that means it also
  // survives past this component's own unmount — reset it on every mount (including a
  // restart's remount) so `frame` genuinely counts since *this* mount, not since page load.
  useEffect(() => {
    stats = ZERO_STATS;
  }, []);

  useFrame(() => {
    const bugs = scene.getObjectByName('bugs') as THREE.InstancedMesh | null;
    const desks = scene.getObjectByName('desks');
    stats = {
      frame: stats.frame + 1,
      drawCalls: gl.info.render.calls,
      bugInstances: bugs?.count ?? 0,
      bugsLive: bugsLive(),
      deskObjects: desks?.children.length ?? 0,
    };
    gl.info.reset(); // autoReset was turned off on the Canvas
  });

  useEffect(() => {
    installBridge({ stats: () => stats, project: (t) => projectTile(t, camera, size, gl) });
    return () => clearBridge(['stats', 'project']);
  }, [camera, size, gl]);

  return null;
}
