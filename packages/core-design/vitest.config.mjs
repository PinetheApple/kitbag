import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      // The package's main build is CommonJS and requires the real react-native.
      {
        find: /^react-native-svg$/,
        replacement: 'react-native-svg/lib/module/index.js',
      },
    ],
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.js',
      '.tsx',
      '.ts',
      '.mjs',
      '.js',
      '.json',
    ],
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    server: { deps: { inline: ['react-native-svg', 'react-native-web'] } },
  },
});
