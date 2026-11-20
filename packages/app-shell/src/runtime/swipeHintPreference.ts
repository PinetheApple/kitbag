import type { Preferences } from '@kitbag/core-db';
import type { SwipeHintPersistence } from '@kitbag/core-state';

import { seenFlagPreference } from './seenFlagPreference';

export function swipeHintPreference(
  preferences: () => Preferences,
): SwipeHintPersistence {
  return seenFlagPreference(
    preferences,
    'swipe_hint_seen',
    'swipe hint dismissal',
  );
}
