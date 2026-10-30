import type { Preferences } from '@kitbag/core-db';
import {
  THEME_CHOICES,
  type AppearanceKey,
  type AppearancePersistence,
  type AppearanceSettings,
} from '@kitbag/core-state';

import { storedPreference, type StoredPreference } from './storedPreference';

export const APPEARANCE_KEYS: Readonly<Record<AppearanceKey, string>> = {
  theme: 'appearance_theme',
  haptics: 'appearance_haptics',
  keepScreenAwake: 'appearance_keep_screen_awake',
};

const FLAG = { on: '1', off: '0' } as const;

function readFlag(stored: StoredPreference): boolean | undefined {
  const value = stored.read();
  if (value === FLAG.on) return true;
  if (value === FLAG.off) return false;
  return undefined;
}

function encode(value: AppearanceSettings[AppearanceKey]): string {
  if (typeof value === 'boolean') return value ? FLAG.on : FLAG.off;
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
      for (const key of Object.keys(changed) as AppearanceKey[]) {
        const value = changed[key];
        if (value !== undefined) stored(key).write(encode(value));
      }
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
