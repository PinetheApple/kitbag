import { defineConfig } from 'vitest/config';

// Reuses the vitest toolchain established in eslint-plugin-kitbag (SPEC §14).
export default defineConfig({
  test: {
    include: ['eval/eval.test.ts', 'src/**/*.test.ts'],
    // Each run spins a real ESLint pass over the scenario tree; give it room.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
