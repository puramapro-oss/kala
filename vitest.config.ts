import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // tests/e2e = specs Playwright (exécutés par `playwright test`, pas vitest) — sans cette
    // exclusion, vitest tente de charger les describe() Playwright et échoue au transform.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
