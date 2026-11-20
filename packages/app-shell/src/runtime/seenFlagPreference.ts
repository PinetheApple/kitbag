import type { Preferences } from '@kitbag/core-db';
import type { SeenFlagPersistence } from '@kitbag/core-state';

import { storedPreference } from './storedPreference';

const SEEN = '1';

export function seenFlagPreference(
  preferences: () => Preferences,
  key: string,
  what: string,
): SeenFlagPersistence {
  const stored = storedPreference(preferences, key, what);
  return {
    load: () => stored.read() === SEEN,
    save: () => {
      stored.write(SEEN);
    },
  };
}
