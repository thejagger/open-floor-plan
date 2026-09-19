import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Measured: the trace screencast costs this suite 5-8x its frame rate (~2fps with
    // screenshots on, 10-17fps with them off), because every frame is rasterised in
    // software. That latency reaches the tests as multi-second `page.evaluate` calls and
    // 30s+ clicks. Keep the action log, which is what a failure is actually read from,
    // and drop the per-frame capture.
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false },
  },
  projects: [
    {
      name: 'chromium-swiftshader',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 640 },
        deviceScaleFactor: 1,
        launchOptions: {
          args: [
            // WebGL here comes from the software rasteriser, not a GPU
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            // No `--disable-gpu-vsync` / `--disable-frame-rate-limit` here, deliberately.
            // Measured on this suite's page (10s samples, seed 1234, fx=off):
            //   uncapped: rAF 73-86/s, the 100ms interval starved to 2.9-3.7/s with a worst
            //             gap of 4.2-5.9s, page.evaluate latency up to 5.7s
            //   capped:   rAF 8/s, the interval a clean 10.0/s with a worst gap of 129ms,
            //             page.evaluate latency at most 62ms
            // Uncapped, rAF callbacks are dispatched back to back and the renderer's ordinary
            // task queue never gets a turn: React's scheduler (a MessageChannel task) stops
            // committing, so the HUD's DOM freezes while the sim keeps running, and
            // Playwright's own evaluates stall for seconds at a time. That is the whole of
            // this suite's intermittent "nothing is updating" failures. Capping costs frame
            // rate the assertions do not measure — the sim advances on wall-clock elapsed
            // time, and setTimeScale(20) still gets its ticks through the catch-up budget at
            // 8fps — and buys back a main thread that answers.
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      },
    },
  ],
  webServer: {
    // --host 127.0.0.1 pins the dev server to the IPv4 loopback: on some machines "localhost"
    // resolves to the IPv6 loopback first, and vite then binds only [::1], leaving the
    // 127.0.0.1 baseURL above unreachable and the readiness probe timing out.
    command: `npm run dev -- --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
