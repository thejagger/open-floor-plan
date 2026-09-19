import type { Snapshot } from '../sim';

export type SceneStats = {
  frame: number; // frames rendered since this scene probe mounted (reset on every mount)
  drawCalls: number; // gl.info.render.calls for the frame just rendered
  bugInstances: number; // InstancedMesh.count on the mesh named 'bugs'
  bugsLive: number; // bugs in the snapshot, sampled in the same frame callback
  deskObjects: number; // children of the group named 'desks'
};

export type TestBridge = {
  snapshot(): Snapshot;
  seed(): number;
  stats(): SceneStats;
  setTimeScale(scale: number): void;
  /** CSS-pixel position of a tile centre, so a test can click a tile without hard-coding
   *  pixels against the camera. */
  project(tile: { x: number; y: number }): { x: number; y: number };
};

declare global {
  interface Window {
    __ofp?: TestBridge;
  }
}

export function installBridge(parts: Partial<TestBridge>): void {
  window.__ofp = { ...(window.__ofp as TestBridge), ...parts } as TestBridge;
}

export function clearBridge(parts: (keyof TestBridge)[]): void {
  if (!window.__ofp) return;
  const remaining: Partial<TestBridge> = { ...window.__ofp };
  for (const key of parts) delete remaining[key];
  window.__ofp = remaining as TestBridge;
}
