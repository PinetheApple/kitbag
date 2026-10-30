import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const stub = (path) => fileURLToPath(new URL(path, import.meta.url));

// Barrels that reach react-native (Flow) or native modules resolve to their pure parts.
export default defineConfig({
  test: {
    include: ['src/logic/**/*.test.ts', 'src/screen/useHoldEngine.test.ts'],
    alias: {
      '@kitbag/core-native': stub(
        '../core-native/src/generated/nativeConstants.gen.ts',
      ),
      '@kitbag/core-design': stub('../core-design/src/pure.ts'),
      'react-native': stub('../core-state/src/testing/reactNativeStub.ts'),
      'expo-haptics': stub('../core-state/src/testing/expoHapticsStub.ts'),
      '@op-engineering/op-sqlite': stub(
        '../core-state/src/testing/opSqliteStub.ts',
      ),
    },
  },
});
