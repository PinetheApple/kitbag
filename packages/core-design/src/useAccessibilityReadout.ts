import { AccessibilityInfo, Platform } from 'react-native';

import {
  readoutSetting,
  useAccessibilitySetting,
} from './accessibilitySetting.ts';

const readout = readoutSetting(Platform.OS, AccessibilityInfo);

export function useAccessibilityReadout(): boolean {
  return useAccessibilitySetting(readout);
}
