import { configureSongPlayer, songLibraryStore } from '@kitbag/core-state';

import { getDatabase } from './database.ts';
import { mixerRuntime } from './mixerRuntime';

configureSongPlayer({
  ...mixerRuntime,
  records: {
    readSong: (id) => getDatabase().songLibrary.readSong(id),
    forLibrarySong: (id) => getDatabase().presets.forLibrarySong(id),
    saveForLibrarySong: (id, values) =>
      getDatabase().presets.saveForLibrarySong(id, values),
  },
  library: {
    correctDuration: (id, durationSec) =>
      songLibraryStore.getState().correctDuration(id, durationSec),
  },
});
