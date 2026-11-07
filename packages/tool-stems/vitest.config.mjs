import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const stub = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: [
      'src/logic/**/*.test.ts',
      'src/screen/stemNames.test.tsx',
      'src/screen/stemPlayerAttach.test.tsx',
    ],
    alias: {
      '@kitbag/core-design': stub('../core-design/src/pure.ts'),
      '@kitbag/core-state': stub('../core-state/src/pure.ts'),
      '@kitbag/core-native': stub(
        '../core-native/src/generated/nativeConstants.gen.ts',
      ),
    },
  },
});
