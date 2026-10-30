import { setHapticsEnabled } from '@kitbag/core-native';
import {
  configureAppearancePersistence,
  getAppearanceStore,
} from '@kitbag/core-state';
import * as SystemUI from 'expo-system-ui';
import { Appearance } from 'react-native';

import { appearanceApplier } from './appearance';
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

export const applyAppearance = appearanceApplier({
  setColorScheme: (scheme) => {
    Appearance.setColorScheme(scheme);
  },
  setBackgroundColor: (hex) => {
    SystemUI.setBackgroundColorAsync(hex).catch(() => undefined);
  },
});
