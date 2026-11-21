import { configureSongPlayer } from '@kitbag/core-state';

import { mixerRuntime } from './mixerRuntime';

configureSongPlayer({
  ...mixerRuntime,
  records: {
    readSong: () => Promise.resolve(undefined),
    saveSongSpeed: () => Promise.resolve(),
    saveSongChosenTempoMode: () => Promise.resolve(),
    forLibrarySong: () => Promise.resolve(undefined),
    saveForLibrarySong: () =>
      Promise.reject(new Error('The web build has no song library')),
  },
  library: { correctDuration: () => Promise.resolve() },
});
