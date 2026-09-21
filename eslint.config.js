import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const RENDERER_FREE =
  'src/sim and src/content are renderer-free: no three, no @react-three, no ../render, no ../ui.';
const SIM_TAKES_CONTENT_BY_INJECTION =
  'src/sim takes content on RunConfig: never import ../content. Data flows content -> sim.';

const rendererFree = [
  { group: ['three', 'three/*', '@react-three/*'], message: RENDERER_FREE },
  { group: ['../render', '**/render/**', '../ui', '**/ui/**'], message: RENDERER_FREE },
];

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            ...rendererFree,
            { group: ['../content', '**/content/**'], message: SIM_TAKES_CONTENT_BY_INJECTION },
          ],
        },
      ],
    },
  },
  {
    files: ['src/content/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: rendererFree }],
    },
  },
);
