import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/game';

async function drawCallsWith(page: Page, bugs: number): Promise<number> {
  await page.goto(`/tests/e2e/fixtures/instancing.html?bugs=${bugs}`);
  await page.waitForFunction(() => (window.__ofp?.stats?.().frame ?? 0) > 3);
  const stats = await page.evaluate(() => window.__ofp!.stats());
  expect(stats.bugInstances).toBe(bugs); // the bugs really are on screen
  return stats.drawCalls;
}

test('renders 25 bugs in the same number of draw calls as 1', async ({ page }) => {
  const one = await drawCallsWith(page, 1);
  const many = await drawCallsWith(page, 25);
  expect(one).toBeGreaterThan(0);
  expect(many).toBe(one);
});
