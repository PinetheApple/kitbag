import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/logic/**/*.test.ts'],
    alias: {
      'react-native': fileURLToPath(
        new URL(
          '../core-state/src/testing/reactNativeStub.ts',
          import.meta.url,
        ),
      ),
    },
  },
});
