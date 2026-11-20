import type { Preferences } from '@kitbag/core-db';
import type { SeenFlagPersistence } from '@kitbag/core-state';

import { seenFlagPreference } from './seenFlagPreference';

export function repeatHintPreference(
  preferences: () => Preferences,
): SeenFlagPersistence {
  return seenFlagPreference(
    preferences,
    'repeat_all_hint_seen',
    'Repeat all hint',
  );
}
