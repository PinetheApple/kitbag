import { configureLastToolPersistence } from '@kitbag/core-state';

import { getDatabase } from './database';
import { lastToolPreference } from './lastToolPreference';

// Imported by the root layout, so the stored tool is loaded before Home renders.
configureLastToolPersistence(
  lastToolPreference(() => getDatabase().preferences),
);
