import { GET_SONG_BPM_KEY_PREFERENCE } from '@kitbag/core-db';
import { configureGetSongBpmKeyPersistence } from '@kitbag/core-state';

import { getSongBpmKeyPersistence } from './getSongBpmKeyPreference';
import { storedWebPreference, WEB_KEY_PREFIX } from './storedWebPreference';

configureGetSongBpmKeyPersistence(
  getSongBpmKeyPersistence(
    storedWebPreference(`${WEB_KEY_PREFIX}${GET_SONG_BPM_KEY_PREFERENCE}`),
  ),
);
