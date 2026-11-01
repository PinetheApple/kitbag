import { configureCountInPersistence } from '@kitbag/core-state';

import { countInPreference } from './countInPreference';
import { getDatabase } from './database';

configureCountInPersistence(countInPreference(() => getDatabase().preferences));
