import { APPEARANCE_PREFERENCE_KEYS, type Preferences } from '@kitbag/core-db';
import {
  THEME_CHOICES,
  type AppearanceKey,
  type AppearancePersistence,
  type AppearanceSettings,
} from '@kitbag/core-state';

import {
  encodeFlag,
  readFlag,
  storedPreference,
  writeChanged,
  type StoredPreference,
} from './storedPreference';

function encode(value: AppearanceSettings[AppearanceKey]): string {
  if (typeof value === 'boolean') return encodeFlag(value);
  return value;
}

export function appearancePersistence(
  stored: (key: AppearanceKey) => StoredPreference,
): AppearancePersistence {
  return {
    load: () => {
      const theme = THEME_CHOICES.find((c) => c === stored('theme').read());
      const haptics = readFlag(stored('haptics'));
      const keepScreenAwake = readFlag(stored('keepScreenAwake'));
      return {
        ...(theme === undefined ? {} : { theme }),
        ...(haptics === undefined ? {} : { haptics }),
        ...(keepScreenAwake === undefined ? {} : { keepScreenAwake }),
      };
    },
    save: (changed) => {
      writeChanged(changed, stored, encode);
    },
  };
}

export function appearancePreference(
  preferences: () => Preferences,
): AppearancePersistence {
  return appearancePersistence((key) =>
    storedPreference(
      preferences,
      APPEARANCE_PREFERENCE_KEYS[key],
      'appearance setting',
    ),
  );
}
