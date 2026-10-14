// The in-tune lock's one confirmation haptic (SPEC §10.2; docs/decisions.md
// 2026-10-14 picks expo-haptics' Android confirm effect). No sound: the player
// is listening to the string.

import { AndroidHaptics, performAndroidHapticsAsync } from 'expo-haptics';
import { Platform } from 'react-native';

export function confirmLockHaptic(): void {
  if (Platform.OS !== 'android') return;
  // A haptic that fails to play is not worth surfacing over the reading.
  performAndroidHapticsAsync(AndroidHaptics.Confirm).catch(() => undefined);
}
