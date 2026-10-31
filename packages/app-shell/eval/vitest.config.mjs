import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Reuses the vitest toolchain established in eslint-plugin-kitbag (SPEC §14).
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['eval/eval.test.ts', 'src/**/*.test.ts'],
    setupFiles: ['eval/nodeStubs.ts'],
    // Each run spins a real ESLint pass over the scenario tree; give it room.
    testTimeout: 30000,
    hookTimeout: 30000,
    // These barrels reach react-native UI; tests need only their pure parts.
    alias: {
      '@kitbag/core-design': fileURLToPath(
        new URL('../../core-design/src/pure.ts', import.meta.url),
      ),
      '@kitbag/tool-metronome': fileURLToPath(
        new URL('../../tool-metronome/src/pure.ts', import.meta.url),
      ),
    },
  },
});
