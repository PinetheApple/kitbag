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
