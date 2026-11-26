import type { Preferences } from '@kitbag/core-db';
import type { SeenFlagPersistence } from '@kitbag/core-state';

import { seenFlagPreference } from './seenFlagPreference';

export function listenerExplainerPreference(
  preferences: () => Preferences,
): SeenFlagPersistence {
  return seenFlagPreference(
    preferences,
    'listener_explainer_declined',
    'Notification access explainer dismissal',
  );
}
