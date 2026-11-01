import { COUNT_IN_PREFERENCE_KEYS } from '@kitbag/core-db';
import { configureCountInPersistence } from '@kitbag/core-state';

import { countInPersistence } from './countInPreference';
import { storedWebPreference, WEB_KEY_PREFIX } from './storedWebPreference';

configureCountInPersistence(
  countInPersistence((key) =>
    storedWebPreference(`${WEB_KEY_PREFIX}${COUNT_IN_PREFERENCE_KEYS[key]}`),
  ),
);
