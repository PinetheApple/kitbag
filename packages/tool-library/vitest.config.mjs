import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const stub = (path) => fileURLToPath(new URL(path, import.meta.url));

// The core-design barrel reaches react-native; logic needs only its pure parts.
export default defineConfig({
  test: {
    include: ['src/logic/**/*.test.ts'],
    alias: {
      '@kitbag/core-design': stub('../core-design/src/pure.ts'),
    },
  },
});
