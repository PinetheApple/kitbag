import type { ApplyReport } from '@kitbag/core-db';
import { pickBackup, saveBackup, shareBackup } from '@kitbag/core-native';
import {
  clickSoundStore,
  configureBackup,
  libraryStore,
  releaseStaleSounds,
  reloadAppearanceStore,
  reloadCountInPersistence,
  reloadHomeLayoutStore,
  reloadStandaloneMetronomePersistence,
  songLibraryStore,
  tunerStore,
} from '@kitbag/core-state';

import { reloadRigSettings, routeLatency } from '@/settings/rigRuntime';

import { getDatabase } from './database.ts';

export async function refreshAfterRestore(report: ApplyReport): Promise<void> {
  // Replace re-inserts presets and setlist items, so held ids may be gone or
  // reused; clearSong's undo would re-link one, so this drops them outright.
  libraryStore.setState({ loaded: null, discarded: null, played: [] });
  reloadCountInPersistence();
  reloadStandaloneMetronomePersistence();
  reloadAppearanceStore();
  reloadHomeLayoutStore();
  releaseStaleSounds(report);
  await Promise.all([
    libraryStore.getState().refresh(),
    songLibraryStore.getState().refresh(),
    tunerStore.getState().loadCustomTunings(),
    clickSoundStore.getState().sync(),
    reloadRigSettings(),
  ]);
}

configureBackup({
  service: () => getDatabase().backup,
  pick: pickBackup,
  share: shareBackup,
  save: saveBackup,
  beforeRestore: () => routeLatency.getState().flush(),
  afterRestore: refreshAfterRestore,
});
