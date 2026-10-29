import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const stub = (path) => fileURLToPath(new URL(path, import.meta.url));

// The core-design and core-state barrels reach react-native; logic needs only
// their pure parts.
export default defineConfig({
  test: {
    include: ['src/logic/**/*.test.ts'],
    alias: {
      '@kitbag/core-design': stub('../core-design/src/pure.ts'),
      '@kitbag/core-state': stub('../core-state/src/pure.ts'),
    },
  },
});
