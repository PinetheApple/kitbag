import { COUNT_IN_PREFERENCE_KEYS, type Preferences } from '@kitbag/core-db';
import {
  isCountInBars,
  isCountInScope,
  isSoundId,
  type CountInPersistence,
  type CountInSettings,
} from '@kitbag/core-state';

import {
  encodeFlag,
  readFlag,
  storedPreference,
  type StoredPreference,
} from './storedPreference';

export type CountInKey = keyof typeof COUNT_IN_PREFERENCE_KEYS;

const WHOLE_NUMBER = /^\d+$/;

function readWhole(stored: StoredPreference): number | undefined {
  const value = stored.read();
  return value !== undefined && WHOLE_NUMBER.test(value)
    ? Number(value)
    : undefined;
}

function encode(value: CountInSettings[CountInKey]): string {
  if (typeof value === 'boolean') return encodeFlag(value);
  return String(value);
}

export function countInPersistence(
  stored: (key: CountInKey) => StoredPreference,
): CountInPersistence {
  return {
    load: () => {
      const scope = stored('scope').read();
      const bars = readWhole(stored('bars'));
      const distinct = readFlag(stored('distinct'));
      const sound = readWhole(stored('sound'));
      return {
        ...(isCountInScope(scope) ? { scope } : {}),
        ...(bars !== undefined && isCountInBars(bars) ? { bars } : {}),
        ...(distinct === undefined ? {} : { distinct }),
        ...(sound !== undefined && isSoundId(sound) ? { sound } : {}),
      };
    },
    save: (changed) => {
      for (const key of Object.keys(changed) as CountInKey[]) {
        const value = changed[key];
        if (value !== undefined) stored(key).write(encode(value));
      }
    },
  };
}

export function countInPreference(
  preferences: () => Preferences,
): CountInPersistence {
  return countInPersistence((key) =>
    storedPreference(
      preferences,
      COUNT_IN_PREFERENCE_KEYS[key],
      'count-in setting',
    ),
  );
}
