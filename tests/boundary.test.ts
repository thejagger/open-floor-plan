import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BANNED = ['three', '@react-three/fiber', '../render/Stage', '../ui/Hud'];
const PROBES = ['src/sim/__boundary_probe__.ts', 'src/content/__boundary_probe__.ts'];

afterEach(() => {
  for (const probe of PROBES) rmSync(resolve(ROOT, probe), { force: true });
});

describe('the renderer-free boundary', () => {
  it.each(PROBES)(
    'npm run lint fails when %s imports the render layer',
    (probe) => {
      const source = `${BANNED.map((s) => `import '${s}';`).join('\n')}\nexport const probe = true;\n`;
      writeFileSync(resolve(ROOT, probe), source, 'utf8');

      const lint = spawnSync('npm', ['run', 'lint'], { cwd: ROOT, encoding: 'utf8', shell: true });
      const output = `${lint.stdout ?? ''}${lint.stderr ?? ''}`;

      expect(lint.status).not.toBe(0);
      expect(output).toContain('no-restricted-imports');
      for (const specifier of BANNED) expect(output).toContain(specifier);
    },
    180_000,
  );
});
