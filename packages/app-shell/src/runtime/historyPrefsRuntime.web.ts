import { configureHistoryPrefsPersistence } from '@kitbag/core-state';

import {
  HISTORY_PREFERENCE_KEYS,
  historyPrefsPersistence,
} from './historyPrefsPreference';
import { storedWebPreference, WEB_KEY_PREFIX } from './storedWebPreference';

configureHistoryPrefsPersistence(
  historyPrefsPersistence((key) =>
    storedWebPreference(`${WEB_KEY_PREFIX}${HISTORY_PREFERENCE_KEYS[key]}`),
  ),
);
