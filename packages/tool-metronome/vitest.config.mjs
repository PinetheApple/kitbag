import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// src/logic is pure; its only @kitbag runtime import is engine constants, so
// the core-native barrel (which pulls react-native) resolves to them directly.
export default defineConfig({
  test: {
    include: ['src/logic/**/*.test.ts'],
    alias: {
      '@kitbag/core-native': fileURLToPath(
        new URL(
          '../core-native/src/generated/nativeConstants.gen.ts',
          import.meta.url,
        ),
      ),
    },
  },
});
