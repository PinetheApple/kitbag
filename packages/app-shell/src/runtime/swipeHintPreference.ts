import type { Preferences } from '@kitbag/core-db';
import type { SwipeHintPersistence } from '@kitbag/core-state';

import { storedPreference } from './storedPreference';

const KEY = 'swipe_hint_seen';
const SEEN = '1';

export function swipeHintPreference(
  preferences: () => Preferences,
): SwipeHintPersistence {
  const stored = storedPreference(preferences, KEY, 'swipe hint dismissal');
  return {
    load: () => stored.read() === SEEN,
    save: () => {
      stored.write(SEEN);
    },
  };
}
