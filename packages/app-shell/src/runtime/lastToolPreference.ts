import type { Preferences } from '@kitbag/core-db';
import type { LastToolPersistence } from '@kitbag/core-state';

import { storedPreference } from './storedPreference';

const KEY = 'last_tool';

export function lastToolPreference(
  preferences: () => Preferences,
): LastToolPersistence {
  const stored = storedPreference(preferences, KEY, 'last-used tool');
  return { load: stored.read, save: stored.write };
}
