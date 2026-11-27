import { configureSongPlayer, songLibraryStore } from '@kitbag/core-state';

import { getDatabase } from './database.ts';
import { mixerRuntime } from './mixerRuntime';

configureSongPlayer({
  ...mixerRuntime,
  records: {
    readSong: (id) => getDatabase().songLibrary.readSong(id),
    saveSongSpeed: (id, speed) =>
      getDatabase().songLibrary.saveSongSpeed(id, speed),
    saveSongChosenTempoMode: (id, mode) =>
      getDatabase().songLibrary.saveSongChosenTempoMode(id, mode),
    saveSongManualTempo: (id, change) =>
      getDatabase().songLibrary.saveSongManualTempo(id, change),
    forLibrarySong: (id) => getDatabase().presets.forLibrarySong(id),
    saveForLibrarySong: (id, values) =>
      getDatabase().presets.saveForLibrarySong(id, values),
  },
  library: {
    correctDuration: (id, durationSec) =>
      songLibraryStore.getState().correctDuration(id, durationSec),
    refresh: () => songLibraryStore.getState().refresh(),
  },
});
