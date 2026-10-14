import { defineConfig } from 'vitest/config';

// Logic only: src/logic/* is pure and imports no React, no react-native and no
// @kitbag barrel, so it runs in plain node with no transform or stub.
export default defineConfig({
  test: {
    include: ['src/logic/**/*.test.ts'],
  },
});
