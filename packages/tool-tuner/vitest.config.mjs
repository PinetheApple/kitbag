import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Logic only: src/logic/* is pure and imports no React. It does import the
// @kitbag/core-native barrel for the generated tuner constants, and that barrel
// re-exports NativeKitbagCommands, which imports react-native; its Flow-typed
// entrypoint fails the vitest transform. Same stub as core-state's.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/logic/**/*.test.ts', 'src/screen/TuningSheet.test.tsx'],
    alias: {
      '@kitbag/core-design': fileURLToPath(
        new URL('../core-design/src/pure.ts', import.meta.url),
      ),
      'react-native': fileURLToPath(
        new URL('./src/testing/reactNativeStub.ts', import.meta.url),
      ),
      'expo-haptics': fileURLToPath(
        new URL('./src/testing/expoHapticsStub.ts', import.meta.url),
      ),
      '@op-engineering/op-sqlite': fileURLToPath(
        new URL('./src/testing/opSqliteStub.ts', import.meta.url),
      ),
    },
  },
});
