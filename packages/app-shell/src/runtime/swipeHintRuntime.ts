import { configureSwipeHintPersistence } from '@kitbag/core-state';

import { getDatabase } from './database';
import { swipeHintPreference } from './swipeHintPreference';

configureSwipeHintPersistence(
  swipeHintPreference(() => getDatabase().preferences),
);
