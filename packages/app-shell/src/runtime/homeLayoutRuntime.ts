import { configureHomeLayoutPersistence } from '@kitbag/core-state';

import { getDatabase } from './database';
import { homeLayoutPreference } from './homeLayoutPreference';

configureHomeLayoutPersistence(
  homeLayoutPreference(() => getDatabase().preferences),
);
