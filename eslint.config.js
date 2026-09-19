import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const RENDERER_FREE =
  'src/sim and src/content are renderer-free: no three, no @react-three, no ../render, no ../ui.';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['src/sim/**/*.ts', 'src/content/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*', '@react-three/*'], message: RENDERER_FREE },
            {
              group: ['../render', '**/render/**', '../ui', '**/ui/**'],
              message: RENDERER_FREE,
            },
          ],
        },
      ],
    },
  },
);
