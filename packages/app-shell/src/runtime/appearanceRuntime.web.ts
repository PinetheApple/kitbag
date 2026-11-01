import {
  configureAppearancePersistence,
  type AppearanceKey,
} from '@kitbag/core-state';
import * as SystemUI from 'expo-system-ui';

import { appearanceApplier } from './appearance';
import { APPEARANCE_KEYS, appearancePersistence } from './appearancePreference';
import { storedWebPreference, WEB_KEY_PREFIX } from './storedWebPreference';

configureAppearancePersistence(
  appearancePersistence((key: AppearanceKey) =>
    storedWebPreference(`${WEB_KEY_PREFIX}${APPEARANCE_KEYS[key]}`),
  ),
);

export const applyAppearance = appearanceApplier({
  setNightMode: () => undefined,
  setSystemBarAppearance: () => undefined,
  setBackgroundColor: (hex) => {
    SystemUI.setBackgroundColorAsync(hex).catch(() => undefined);
  },
});
