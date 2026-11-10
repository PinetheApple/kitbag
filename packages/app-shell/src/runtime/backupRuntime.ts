import { pickBackup, shareBackup } from '@kitbag/core-native';
import {
  configureBackup,
  libraryStore,
  reloadCountInPersistence,
  songLibraryStore,
  tunerStore,
} from '@kitbag/core-state';

import { getDatabase } from './database.ts';

export async function refreshAfterRestore(): Promise<void> {
  // Replace re-inserts presets and setlist items, so held ids may be gone or
  // reused; clearSong's undo would re-link one, so this drops them outright.
  libraryStore.setState({ loaded: null, discarded: null, played: [] });
  reloadCountInPersistence();
  await Promise.all([
    libraryStore.getState().refresh(),
    songLibraryStore.getState().refresh(),
    tunerStore.getState().loadCustomTunings(),
  ]);
}

configureBackup({
  service: () => getDatabase().backup,
  pick: pickBackup,
  share: shareBackup,
  afterRestore: refreshAfterRestore,
});
