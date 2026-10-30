import type { Preferences } from '@kitbag/core-db';
import type { AppearanceKey, AppearancePersistence } from '@kitbag/core-state';

import { storedPreference, type StoredPreference } from './storedPreference';

export const APPEARANCE_KEYS: Readonly<Record<AppearanceKey, string>> = {
  theme: 'appearance_theme',
  haptics: 'appearance_haptics',
  keepScreenAwake: 'appearance_keep_screen_awake',
};

export function appearancePersistence(
  stored: (key: AppearanceKey) => StoredPreference,
): AppearancePersistence {
  return {
    read: (key) => stored(key).read(),
    write: (key, value) => {
      stored(key).write(value);
    },
  };
}

export function appearancePreference(
  preferences: () => Preferences,
): AppearancePersistence {
  return appearancePersistence((key) =>
    storedPreference(preferences, APPEARANCE_KEYS[key], 'appearance setting'),
  );
}
