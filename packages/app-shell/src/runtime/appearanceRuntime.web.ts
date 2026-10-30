import {
  configureAppearancePersistence,
  type AppearanceKey,
} from '@kitbag/core-state';
import * as SystemUI from 'expo-system-ui';

import { appearanceApplier } from './appearance';
import { APPEARANCE_KEYS, appearancePersistence } from './appearancePreference';
import { storedWebPreference } from './storedWebPreference';

const WEB_KEY_PREFIX = 'kitbag.';

configureAppearancePersistence(
  appearancePersistence((key: AppearanceKey) =>
    storedWebPreference(`${WEB_KEY_PREFIX}${APPEARANCE_KEYS[key]}`),
  ),
);

export const applyAppearance = appearanceApplier({
  setColorScheme: () => undefined,
  setBackgroundColor: (hex) => {
    SystemUI.setBackgroundColorAsync(hex).catch(() => undefined);
  },
});
