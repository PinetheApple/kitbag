import { configureStandaloneMetronomePersistence } from '@kitbag/core-state';

import { getDatabase } from './database';
import { standaloneMetronomePreference } from './standaloneMetronomePreference';

configureStandaloneMetronomePersistence(
  standaloneMetronomePreference(() => getDatabase().preferences),
);
