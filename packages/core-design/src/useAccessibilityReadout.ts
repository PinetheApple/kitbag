import { AccessibilityInfo, Platform } from 'react-native';

import {
  readoutSetting,
  useAccessibilitySetting,
  type AccessibilitySource,
} from './accessibilitySetting.ts';

// RN 0.83 emits accessibilityServiceChanged on Android, but its typings omit it.
const readout = readoutSetting(
  Platform.OS,
  AccessibilityInfo as unknown as AccessibilitySource,
);

export function useAccessibilityReadout(): boolean {
  return useAccessibilitySetting(readout);
}
