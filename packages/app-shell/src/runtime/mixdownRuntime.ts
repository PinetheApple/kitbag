import {
  getKitbagLibrary,
  mixdownCancel,
  mixdownProgress,
  mixdownStart,
  mixdownState,
  shareExport,
} from '@kitbag/core-native';
import type { MixdownRuntime } from '@kitbag/core-state';
import { AccessibilityInfo, AppState } from 'react-native';

const ON_SCREEN = 'active';

export const mixdownRuntime: MixdownRuntime = {
  start: mixdownStart,
  cancel: mixdownCancel,
  progress: mixdownProgress,
  state: mixdownState,
  share: shareExport,
  announce: (message) => {
    AccessibilityInfo.announceForAccessibility(message);
  },
  foreground: () => AppState.currentState === ON_SCREEN,
  codes: () => getKitbagLibrary().getConstants(),
};
