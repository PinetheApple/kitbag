import {
  bindLibraryRemovals,
  configureLibrary,
  configurePlayOrder,
  libraryStore,
  playOrderStore,
  songLibraryStore,
} from '@kitbag/core-state';

import { getDatabase } from './database.ts';

configureLibrary({
  get setlists() {
    return getDatabase().setlists;
  },
  get presets() {
    return getDatabase().presets;
  },
});

configurePlayOrder({
  get queue() {
    return getDatabase().playQueue;
  },
});

bindLibraryRemovals(songLibraryStore, libraryStore, playOrderStore);
