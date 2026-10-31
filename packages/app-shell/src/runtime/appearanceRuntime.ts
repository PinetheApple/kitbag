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

import { appearanceApplier, keepNightMode } from './appearance';
import { appearancePreference } from './appearancePreference';
import { onAppForeground } from './appForeground';
import { getDatabase } from './database';

configureAppearancePersistence(
  appearancePreference(() => getDatabase().preferences),
);

const store = getAppearanceStore();
setHapticsEnabled(store.getState().haptics);
store.subscribe((state) => {
  setHapticsEnabled(state.haptics);
});

// expo-system-ui resets the night mode in every activity onCreate; see docs/decisions.md.
keepNightMode({
  choice: () => store.getState().theme,
  setNightMode: setAppNightMode,
  onForeground: onAppForeground,
});

export const applyAppearance = appearanceApplier({
  setNightMode: setAppNightMode,
  setSystemBarAppearance,
  setBackgroundColor: (hex) => {
    SystemUI.setBackgroundColorAsync(hex).catch(() => undefined);
  },
});
