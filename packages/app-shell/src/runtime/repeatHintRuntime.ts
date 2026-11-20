import { configureRepeatAllHintPersistence } from '@kitbag/core-state';

import { getDatabase } from './database';
import { repeatHintPreference } from './repeatHintPreference';

configureRepeatAllHintPersistence(
  repeatHintPreference(() => getDatabase().preferences),
);
