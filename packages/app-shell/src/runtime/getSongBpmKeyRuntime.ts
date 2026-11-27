import { configureGetSongBpmKeyPersistence } from '@kitbag/core-state';

import { getDatabase } from './database';
import { getSongBpmKeyPreference } from './getSongBpmKeyPreference';

configureGetSongBpmKeyPersistence(
  getSongBpmKeyPreference(() => getDatabase().preferences),
);
