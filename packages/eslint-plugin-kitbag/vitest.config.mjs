import { defineConfig } from 'vitest/config';

// @typescript-eslint/rule-tester drives cases through the ambient test hooks
// (describe/it/afterAll), so vitest globals must be on.
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
