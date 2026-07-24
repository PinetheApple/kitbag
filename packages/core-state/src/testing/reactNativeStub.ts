// Test-only stub for `react-native`, wired via vitest.config.mjs alias. The
// core-native barrel re-exports NativeKitbagCommands, which imports react-native
// whose Flow-typed entrypoint the vitest transform cannot parse. The metronome
// store injects mock commands under test, so the real TurboModule registry is
// never reached — this stub only has to satisfy the one runtime symbol that
// module binds. Not shipped: no source imports it.
export const TurboModuleRegistry = {
  getEnforcing: (): never => {
    throw new Error(
      'react-native stub (test only): TurboModuleRegistry is unavailable under vitest',
    );
  },
};
