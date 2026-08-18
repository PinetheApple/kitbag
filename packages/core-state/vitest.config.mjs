import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// The core-native barrel re-exports NativeKitbagCommands, which imports
// react-native; its Flow-typed entrypoint fails the vitest transform. The store
// injects mock commands under test, so alias react-native to a stub that only
// carries the one runtime symbol that module binds (see src/testing).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    alias: {
      'react-native': fileURLToPath(
        new URL('./src/testing/reactNativeStub.ts', import.meta.url),
      ),
    },
  },
});
