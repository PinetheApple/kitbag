import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const local = (path) => fileURLToPath(new URL(path, import.meta.url));
const stateStub = (name) => local(`../core-state/src/testing/${name}.ts`);

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    alias: {
      'react-native': stateStub('reactNativeHosts'),
      'react-native-reanimated': stateStub('reanimatedDriver'),
      'react-native-worklets': stateStub('reanimatedDriver'),
      'react-native-gesture-handler': stateStub('nativeLeaves'),
      'react-native-keyboard-controller': stateStub('nativeLeaves'),
      'react-native-svg': stateStub('nativeLeaves'),
      '@expo/vector-icons/MaterialCommunityIcons': stateStub('iconLeaf'),
      'expo-haptics': stateStub('expoHapticsStub'),
      '@op-engineering/op-sqlite': stateStub('opSqliteStub'),
    },
  },
});
