// Test-only stub for `expo-haptics`, wired via vitest.config.mjs alias: the
// core-native barrel exports confirmHaptic, and the real module needs Expo.
export const AndroidHaptics = {
  Confirm: 'confirm',
  Segment_Tick: 'segment-tick',
} as const;
export const performAndroidHapticsAsync = (): Promise<void> =>
  Promise.resolve();
