import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** What a renderer-free module may never import. */
const RENDERER_FREE = ['three', '@react-three/fiber', '../render/Stage', '../ui/Hud'];

/**
 * One probe per renderer-free root, each carrying the specifiers *that* root must refuse. The
 * list is per-probe rather than shared because the roots do not ban the same set: a rule that
 * bans `../content` from `src/sim` must leave `src/content` importing its own siblings.
 */
export const PROBES: { path: string; banned: string[] }[] = [
  { path: 'src/sim/__boundary_probe__.ts', banned: RENDERER_FREE },
  { path: 'src/content/__boundary_probe__.ts', banned: RENDERER_FREE },
];

/**
 * The stylish report's block for one file — its path header and the errors listed under it.
 * Asserting inside the block, not across the whole report, is what keeps the probes telling
 * apart: a probe whose glob fell out of `eslint.config.js` has no block at all, and each
 * probe's banned list is proven against its own errors rather than against its neighbour's.
 */
function reportFor(output: string, probePath: string): string {
  const header = (block: string) => block.trimStart().split(/\r?\n/)[0].replaceAll('\\', '/');
  const blocks = output.split(/\r?\n[ \t]*\r?\n/);
  return blocks.find((block) => header(block).trim().endsWith(probePath)) ?? '';
}

describe('the renderer-free boundary', () => {
  let status: number | null = null;
  let output = '';

  // Both probes are planted for a single `npm run lint`, once for the whole file: ESLint's
  // startup is the entire cost here (~3.4s a spawn, most of this suite's runtime), and one run
  // reports both files, so a spawn per probe paid twice over for one rule. Each probe is still
  // judged on its own block of the report, so the discrimination a spawn each bought is kept.
  beforeAll(() => {
    for (const { path, banned } of PROBES) {
      const source = `${banned.map((s) => `import '${s}';`).join('\n')}\nexport const probe = true;\n`;
      writeFileSync(resolve(ROOT, path), source, 'utf8');
    }
    const lint = spawnSync('npm', ['run', 'lint'], { cwd: ROOT, encoding: 'utf8', shell: true });
    status = lint.status;
    output = `${lint.stdout ?? ''}${lint.stderr ?? ''}`;
  }, 180_000);

  afterAll(() => {
    for (const { path } of PROBES) rmSync(resolve(ROOT, path), { force: true });
  });

  it.each(PROBES)('npm run lint fails when $path imports the render layer', ({ path, banned }) => {
    expect(status).not.toBe(0);

    const reported = reportFor(output, path);
    expect(reported, `lint reported nothing against ${path}`).not.toBe('');
    expect(reported).toContain('no-restricted-imports');
    for (const specifier of banned) {
      expect(reported).toContain(`'${specifier}' import is restricted`);
    }
  });
});
