import {
  configureStandaloneMetronomePersistence,
  flushStandaloneMetronomePersistence,
} from '@kitbag/core-state';

import { onAppBackground } from './appState';
import { getDatabase } from './database';
import { standaloneMetronomePreference } from './standaloneMetronomePreference';

configureStandaloneMetronomePersistence(
  standaloneMetronomePreference(() => getDatabase().preferences),
);
onAppBackground(flushStandaloneMetronomePersistence);
