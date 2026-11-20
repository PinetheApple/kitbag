import { configureHistoryPrefsPersistence } from '@kitbag/core-state';

import { getDatabase } from './database';
import { historyPrefsPreference } from './historyPrefsPreference';

configureHistoryPrefsPersistence(
  historyPrefsPreference(() => getDatabase().preferences),
);
