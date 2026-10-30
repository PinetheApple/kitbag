import { AndroidHaptics, performAndroidHapticsAsync } from 'expo-haptics';
import { Platform } from 'react-native';

// A haptic that fails to play is not worth surfacing over whatever triggered it.
function playAndroidHaptic(effect: AndroidHaptics): void {
  if (Platform.OS !== 'android') return;
  performAndroidHapticsAsync(effect).catch(() => undefined);
}

// Android's confirm effect (docs/decisions.md, 2026-10-14).
export function confirmHaptic(): void {
  playAndroidHaptic(AndroidHaptics.Confirm);
}

export function tickHaptic(): void {
  playAndroidHaptic(AndroidHaptics.Segment_Tick);
}
