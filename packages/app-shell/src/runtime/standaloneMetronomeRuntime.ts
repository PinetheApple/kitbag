import {
  configureStandaloneMetronomePersistence,
  flushStandaloneMetronomePersistence,
} from '@kitbag/core-state';

import { onAppBackground } from './appForeground';
import { getDatabase } from './database';
import { standaloneMetronomePreference } from './standaloneMetronomePreference';

configureStandaloneMetronomePersistence(
  standaloneMetronomePreference(() => getDatabase().preferences),
);
onAppBackground(flushStandaloneMetronomePersistence);
