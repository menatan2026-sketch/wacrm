import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**']),
  {
    // RTL: physical left/right are banned in component code; use logical properties.
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/\\b(ml|mr|pl|pr|left|right|text-left|text-right)-[0-9a-z[]/]",
          message: 'Use logical properties (ms-/me-/ps-/pe-/start-/end-/text-start/text-end) so layouts mirror in RTL.',
        },
      ],
    },
  },
]);
