import type { Preferences } from '@kitbag/core-db';
import type { SeenFlagPersistence } from '@kitbag/core-state';

import { storedPreference, type StoredPreference } from './storedPreference';

const SEEN = '1';

export function seenFlag(stored: StoredPreference): SeenFlagPersistence {
  return {
    load: () => stored.read() === SEEN,
    save: () => {
      stored.write(SEEN);
    },
  };
}

export function seenFlagPreference(
  preferences: () => Preferences,
  key: string,
  what: string,
): SeenFlagPersistence {
  return seenFlag(storedPreference(preferences, key, what));
}
