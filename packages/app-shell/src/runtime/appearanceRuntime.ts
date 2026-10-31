import {
  setAppNightMode,
  setHapticsEnabled,
  setSystemBarAppearance,
} from '@kitbag/core-native';
import {
  configureAppearancePersistence,
  getAppearanceStore,
} from '@kitbag/core-state';
import * as SystemUI from 'expo-system-ui';
import { AppState } from 'react-native';

import { appearanceApplier, keepNightMode } from './appearance';
import { appearancePreference } from './appearancePreference';
import { getDatabase } from './database';

configureAppearancePersistence(
  appearancePreference(() => getDatabase().preferences),
);

const store = getAppearanceStore();
setHapticsEnabled(store.getState().haptics);
store.subscribe((state) => {
  setHapticsEnabled(state.haptics);
});

// Below API 31 expo-system-ui resets the night mode in every activity onCreate,
// and a recreated activity always resumes, so re-apply on each return to active.
keepNightMode({
  choice: () => store.getState().theme,
  setNightMode: setAppNightMode,
  onForeground: (listener) => {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') listener();
    });
  },
});

export const applyAppearance = appearanceApplier({
  setNightMode: setAppNightMode,
  setSystemBarAppearance,
  setBackgroundColor: (hex) => {
    SystemUI.setBackgroundColorAsync(hex).catch(() => undefined);
  },
});
