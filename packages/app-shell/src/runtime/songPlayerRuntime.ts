import { configureSongPlayer, songLibraryStore } from '@kitbag/core-state';

import { getDatabase } from './database.ts';
import { mixerRuntime } from './mixerRuntime';

configureSongPlayer({
  ...mixerRuntime,
  records: { readSong: (id) => getDatabase().songLibrary.readSong(id) },
  library: {
    correctDuration: (id, durationSec) =>
      songLibraryStore.getState().correctDuration(id, durationSec),
  },
});
