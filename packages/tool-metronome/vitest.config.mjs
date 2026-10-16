import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const stub = (path) => fileURLToPath(new URL(path, import.meta.url));

// The core-native barrel pulls react-native, whose Flow entrypoint vitest cannot
// parse; logic needs only engine constants, and core-state's imports get stubs.
export default defineConfig({
  test: {
    include: ['src/logic/**/*.test.ts'],
    alias: {
      '@kitbag/core-native': stub(
        '../core-native/src/generated/nativeConstants.gen.ts',
      ),
      'react-native': stub('../core-state/src/testing/reactNativeStub.ts'),
      'expo-haptics': stub('../core-state/src/testing/expoHapticsStub.ts'),
      '@op-engineering/op-sqlite': stub(
        '../core-state/src/testing/opSqliteStub.ts',
      ),
    },
  },
});
