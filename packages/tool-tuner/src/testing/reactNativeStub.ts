// Test-only stub for `react-native`, wired via vitest.config.mjs alias, so the
// logic tests can import generated constants from the core-native barrel. No
// test reaches the TurboModule registry. Not shipped: no source imports it.
export const TurboModuleRegistry = {
  getEnforcing: (): never => {
    throw new Error(
      'react-native stub (test only): TurboModuleRegistry is unavailable under vitest',
    );
  },
};

// core-native's confirmHaptic reads it; no test plays a haptic.
export const Platform = { OS: 'test' };
