import { expect, test as base, type Page } from '@playwright/test';

export const SEED = 1234;

/** Console errors and uncaught exceptions, collected for the whole test. */
export const test = base.extend<{ problems: string[]; evidence: void }>({
  problems: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    await use(problems);
  },
  evidence: [async ({ page, problems }, use, testInfo) => {
    await installDiagnostics(page);
    await use();
    if (testInfo.status === testInfo.expectedStatus) return;
    const diag = await diagnose(page).catch((e: Error) => `unavailable: ${e.message}`);
    console.log(`\n--- page evidence ---\n${JSON.stringify(diag, null, 2)}`
      + `\nproblems: ${JSON.stringify(problems, null, 2)}\n`);
  }, { auto: true }],
});
export { expect };

/**
 * Waits until both halves of the bridge are installed. Optional-call on `stats`, not just
 * `__ofp`: the engine half (snapshot/seed/setTimeScale) installs before SceneProbe's
 * stats/project half does, so `stats` is briefly undefined — on a fresh mount, and again
 * after a restart remounts the run and tears the scene half down and back up.
 */
export const waitForBridge = (page: Page) =>
  page.waitForFunction(() => typeof window.__ofp?.stats === 'function'
    && (window.__ofp?.stats?.().frame ?? 0) > 2);

export type OpenOptions = {
  seed?: number;
  /** 'off' drops post-processing (see src/dev/flags.ts). Use it wherever the test asserts on
   *  the sim or the scene graph rather than on the grade: fast-forwarding a full wave through
   *  depth of field and bloom under SwiftShader is what makes a run take minutes. Tests that
   *  judge render output leave it on. */
  fx?: 'on' | 'off';
};

/**
 * Page-side evidence about *why* the render loop might have stopped, installed before any app
 * code runs. An independent rAF chain and an independent timer chain say whether the browser
 * is still scheduling at all; the WebGL context log says whether the renderer lost its context
 * underneath us. Together they separate "the browser stopped" from "the app stopped".
 */
export type Diagnostics = {
  rafTicks: number;
  /** ms since the independent rAF chain last ran. Large = rAF itself is not firing. */
  rafAgeMs: number;
  timerTicks: number;
  /** longest gap the 100ms interval ever saw — how badly ordinary tasks are starved. */
  timerWorstGapMs: number;
  timerAgeMs: number;
  /** webglcontextlost/restored/creationerror and visibility changes, in order, with timestamps. */
  events: string[];
  /** every change in (sim phase, sim tick coarse, HUD DOM text, button disabled), sampled from
   *  rAF so it records even while ordinary tasks are starved. */
  timeline: string[];
  visibility: string;
};

type DiagBuffer = {
  rafTicks: number; rafAt: number;
  timerTicks: number; timerAt: number; timerWorstGap: number;
  events: string[]; timeline: string[]; last: string;
};

declare global {
  interface Window { __ofpDiag?: DiagBuffer }
}

const installDiagnostics = (page: Page) => page.addInitScript(() => {
  const now = () => performance.now();
  const diag: DiagBuffer = {
    rafTicks: 0, rafAt: now(),
    timerTicks: 0, timerAt: now(), timerWorstGap: 0,
    events: [], timeline: [], last: '',
  };
  window.__ofpDiag = diag;
  const stamp = () => `@${Math.round(now())}ms`;

  // sampled from rAF, which keeps running even when ordinary tasks do not
  const beat = () => {
    diag.rafTicks += 1;
    diag.rafAt = now();
    const snap = window.__ofp?.snapshot?.();
    const desks = document.querySelector('[data-testid="desks-remaining"]')?.textContent ?? '-';
    const start = document.querySelector<HTMLButtonElement>('[data-testid="start-sprint"]');
    const line = `sim=${snap ? `${snap.phase}/t${snap.tick}/d${snap.desksPlaced}` : 'none'}`
      + ` dom=desks:${desks},start:${start ? (start.disabled ? 'off' : 'on') : '-'}`;
    if (line !== diag.last) {
      diag.last = line;
      if (diag.timeline.length < 400) diag.timeline.push(`${stamp()} f${diag.rafTicks} ${line}`);
    }
    requestAnimationFrame(beat);
  };
  requestAnimationFrame(beat);

  setInterval(() => {
    const gap = now() - diag.timerAt;
    if (gap > diag.timerWorstGap) diag.timerWorstGap = gap;
    diag.timerTicks += 1;
    diag.timerAt = now();
  }, 100);

  // capture phase on window, so the listener catches the canvas's context events whether or
  // not they bubble, and catches a canvas created after this script ran
  for (const type of ['webglcontextlost', 'webglcontextrestored', 'webglcontextcreationerror']) {
    window.addEventListener(type, (e) => {
      diag.events.push(`${type}${stamp()} ${(e as { statusMessage?: string }).statusMessage ?? ''}`);
    }, true);
  }
  document.addEventListener('visibilitychange',
    () => diag.events.push(`visibility=${document.visibilityState}${stamp()}`));
});

export const diagnose = (page: Page): Promise<Diagnostics> => page.evaluate(() => {
  const d = window.__ofpDiag!;
  const now = performance.now();
  return {
    rafTicks: d.rafTicks, rafAgeMs: Math.round(now - d.rafAt),
    timerTicks: d.timerTicks, timerWorstGapMs: Math.round(d.timerWorstGap),
    timerAgeMs: Math.round(now - d.timerAt),
    events: d.events, timeline: d.timeline, visibility: document.visibilityState,
  };
});

export async function openGame(page: Page, options: OpenOptions = {}): Promise<void> {
  const { seed = SEED, fx = 'on' } = options;
  await page.goto(`/?seed=${seed}${fx === 'off' ? '&fx=off' : ''}`);
  await waitForBridge(page);
}

export const read = (page: Page) => page.evaluate(() => ({
  snapshot: window.__ofp!.snapshot(),
  seed: window.__ofp!.seed(),
  stats: window.__ofp!.stats(),
}));

/** How long `stats.frame` may sit still before a poll gives up on "just slow" and calls it a
 *  stall. Comfortably under any of this suite's poll timeouts, and comfortably over one frame
 *  even on a loaded SwiftShader renderer. */
const STALL_GRACE_MS = 5_000;

/**
 * Wraps a `read(page)`-derived value for `expect.poll`: if `stats.frame` stops advancing partway
 * through the poll, the render loop itself has stalled (a WebGL/rAF hiccup, not the desk on
 * screen, is the reason nothing changed), and the poll throws that outright instead of quietly
 * re-reading the same frozen value until its own timeout — the two look identical from a single
 * read of the target value alone, and only one of them is a criterion actually failing.
 */
export function pollState<T>(
  page: Page,
  select: (state: Awaited<ReturnType<typeof read>>) => T,
  problems: string[] = [],
): () => Promise<T> {
  let lastFrame = -1;
  let stalledSince = 0;
  return async () => {
    const state = await read(page);
    const { frame } = state.stats;
    if (frame === lastFrame) {
      stalledSince ||= Date.now();
      if (Date.now() - stalledSince > STALL_GRACE_MS) {
        const diag = await diagnose(page);
        throw new Error(`render loop stalled at frame ${frame} (stats/snapshot stopped updating)`
          + `\n  diagnostics: ${JSON.stringify(diag)}`
          + `\n  problems: ${JSON.stringify(problems)}`);
      }
    } else {
      lastFrame = frame;
      stalledSince = 0;
    }
    return select(state);
  };
}

export async function clickTile(page: Page, x: number, y: number): Promise<void> {
  const p = await page.evaluate(([tx, ty]) => window.__ofp!.project({ x: tx, y: ty }), [x, y]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
}

export const setTimeScale = (page: Page, scale: number) =>
  page.evaluate((s) => window.__ofp!.setTimeScale(s), scale);

export const tiles = (snap: { desks: { x: number; y: number }[] }) =>
  snap.desks.map((d) => `${d.x},${d.y}`).sort();

/** Plays whatever layout is on the board through to victory or defeat. */
export async function playToEnd(page: Page, timeoutMs = 150_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const phase = await page.evaluate(() => window.__ofp!.snapshot().phase as string);
    if (phase === 'victory' || phase === 'defeat') return phase;
    if (Date.now() > deadline) throw new Error(`still ${phase} after ${timeoutMs}ms`);
    // The phase read above is a tick old by the time the click is dispatched, and the HUD's
    // `disabled` follows the phase, so a sprint that started (or a run that ended) in between
    // leaves this click waiting on a button that will never be enabled again. Bounded and
    // swallowed: the next turn of the loop re-reads the phase and does the right thing, and a
    // run that is genuinely stuck still fails on this loop's own deadline above — with the
    // phase it was stuck in, which is the more useful error.
    if (phase === 'build') await page.getByTestId('start-sprint').click({ timeout: 2_000 })
      .catch(() => undefined);
    await page.waitForTimeout(150);
  }
}
