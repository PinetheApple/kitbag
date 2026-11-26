import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const stub = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    alias: {
      '@kitbag/core-native': stub('../core-native/src/pure.ts'),
      '@kitbag/core-design': stub('../core-design/src/pure.ts'),
      'react-native': stub('../core-state/src/testing/reactNativeStub.ts'),
      'expo-haptics': stub('../core-state/src/testing/expoHapticsStub.ts'),
      '@op-engineering/op-sqlite': stub(
        '../core-state/src/testing/opSqliteStub.ts',
      ),
    },
  },
});
