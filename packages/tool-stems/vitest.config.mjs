import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const local = (path) => fileURLToPath(new URL(path, import.meta.url));
const stateStub = (name) => local(`../core-state/src/testing/${name}.ts`);

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    alias: {
      'react-native': local('src/testing/reactNativeHosts.ts'),
      'react-native-reanimated': local('src/testing/reanimatedDriver.ts'),
      'react-native-worklets': local('src/testing/reanimatedDriver.ts'),
      'react-native-gesture-handler': local('src/testing/nativeLeaves.ts'),
      'react-native-keyboard-controller': local('src/testing/nativeLeaves.ts'),
      'react-native-svg': local('src/testing/nativeLeaves.ts'),
      '@expo/vector-icons/MaterialCommunityIcons': local(
        'src/testing/iconLeaf.ts',
      ),
      'expo-haptics': stateStub('expoHapticsStub'),
      '@op-engineering/op-sqlite': stateStub('opSqliteStub'),
    },
  },
});
