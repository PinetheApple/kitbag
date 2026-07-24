import { defineConfig } from 'vitest/config';

// The eval harness only — the app-shell package itself has no unit tests yet.
// Reuses the vitest toolchain established in eslint-plugin-kitbag (SPEC §14).
export default defineConfig({
  test: {
    include: ['eval/eval.test.ts'],
    // Each run spins a real ESLint pass over the scenario tree; give it room.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
