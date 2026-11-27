import { GET_SONG_BPM_KEY_PREFERENCE, type Preferences } from '@kitbag/core-db';
import {
  NO_GET_SONG_BPM_KEY,
  type GetSongBpmKeyPersistence,
} from '@kitbag/core-state';

import { storedPreference, type StoredPreference } from './storedPreference';

export function getSongBpmKeyPersistence(
  stored: StoredPreference,
): GetSongBpmKeyPersistence {
  return {
    load: () => stored.read() ?? NO_GET_SONG_BPM_KEY,
    save: (key) => {
      stored.write(key);
    },
  };
}

export function getSongBpmKeyPreference(
  preferences: () => Preferences,
): GetSongBpmKeyPersistence {
  return getSongBpmKeyPersistence(
    storedPreference(
      preferences,
      GET_SONG_BPM_KEY_PREFERENCE,
      'GetSongBPM key',
    ),
  );
}
