import type { ApplyReport } from '@kitbag/core-db';
import { pickBackup, saveBackup, shareBackup } from '@kitbag/core-native';
import {
  clickSoundStore,
  configureBackup,
  libraryStore,
  releaseStaleSounds,
  reloadCountInPersistence,
  reloadStandaloneMetronomePersistence,
  songLibraryStore,
  tunerStore,
} from '@kitbag/core-state';

import { getDatabase } from './database.ts';

export async function refreshAfterRestore(report: ApplyReport): Promise<void> {
  // Replace re-inserts presets and setlist items, so held ids may be gone or
  // reused; clearSong's undo would re-link one, so this drops them outright.
  libraryStore.setState({ loaded: null, discarded: null, played: [] });
  reloadCountInPersistence();
  reloadStandaloneMetronomePersistence();
  releaseStaleSounds(report);
  await Promise.all([
    libraryStore.getState().refresh(),
    songLibraryStore.getState().refresh(),
    tunerStore.getState().loadCustomTunings(),
    clickSoundStore.getState().sync(),
  ]);
}

configureBackup({
  service: () => getDatabase().backup,
  pick: pickBackup,
  share: shareBackup,
  save: saveBackup,
  afterRestore: refreshAfterRestore,
});
