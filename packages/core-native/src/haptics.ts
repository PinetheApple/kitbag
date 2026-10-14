import { AndroidHaptics, performAndroidHapticsAsync } from 'expo-haptics';
import { Platform } from 'react-native';

// Android's confirm effect (docs/decisions.md, 2026-10-14). A haptic that fails
// to play is not worth surfacing over whatever triggered it.
export function confirmHaptic(): void {
  if (Platform.OS !== 'android') return;
  performAndroidHapticsAsync(AndroidHaptics.Confirm).catch(() => undefined);
}
