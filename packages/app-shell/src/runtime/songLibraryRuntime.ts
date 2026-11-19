import {
  getKitbagLibrary,
  fileAvailability,
  watchDataFolder,
} from '@kitbag/core-native';
import {
  configureSongLibrary,
  songLibraryStore,
  songPlayerStore,
  type LibraryFiles,
  type OpenSong,
  type SongLibraryRecords,
} from '@kitbag/core-state';
import { useEffect } from 'react';

import { getDatabase } from './database.ts';

const library = () => getDatabase().songLibrary;

const records: SongLibraryRecords = {
  list: () => library().list(),
  insertSong: (song) => library().insertSong(song),
  beginAnalysis: (id) => library().beginAnalysis(id),
  claimUnfinishedAnalyses: () => library().claimUnfinishedAnalyses(),
  listOutdatedAnalyses: (currentVersion) =>
    library().listOutdatedAnalyses(currentVersion),
  applyAnalysis: (result) => library().applyAnalysis(result),
  deleteSong: (id) => library().deleteSong(id),
  deleteStemSet: (id) => library().deleteStemSet(id),
  findStemSetByJobId: (jobId) => library().findStemSetByJobId(jobId),
  findStemSetMatches: (identity) => library().findStemSetMatches(identity),
  insertStemBundle: (bundle) => library().insertStemBundle(bundle),
  replaceStemBundle: (bundle, targetId) =>
    library().replaceStemBundle(bundle, targetId),
  listStemSetFolders: () => library().listStemSetFolders(),
  listSongFiles: () => library().listSongFiles(),
  listStemFiles: () => library().listStemFiles(),
  renameSong: (id, title) => library().renameSong(id, title),
  renameStemSet: (id, title) => library().renameStemSet(id, title),
  updateDuration: (id, durationSec) =>
    library().updateDuration(id, durationSec),
  saveSongMeterOverride: (id, patch) =>
    library().saveSongMeterOverride(id, patch),
  saveSongTempoCorrection: (id, correction) =>
    library().saveSongTempoCorrection(id, correction),
};

// Resolved per call: getKitbagLibrary throws in a build without the module.
const files: LibraryFiles = {
  constants: () => getKitbagLibrary().getConstants(),
  pickDocument: () => getKitbagLibrary().pickDocument(),
  sniffUnsupportedFormat: (uri) =>
    getKitbagLibrary().sniffUnsupportedFormat(uri),
  pickFolder: () => getKitbagLibrary().pickFolder(),
  importAudio: (uri, relativeDir) =>
    getKitbagLibrary().importAudio(uri, relativeDir),
  enqueueAnalysis: (relativePath, waveformRelativeDir, replace) => {
    getKitbagLibrary().enqueueAnalysis(
      relativePath,
      waveformRelativeDir,
      replace,
    );
  },
  cancelAnalysis: (relativePath) => {
    getKitbagLibrary().cancelAnalysis(relativePath);
  },
  pendingAnalyses: () => getKitbagLibrary().pendingAnalyses(),
  acknowledgeAnalysis: (relativePath) => {
    getKitbagLibrary().acknowledgeAnalysis(relativePath);
  },
  onAnalysis: (listener) => {
    const subscription = getKitbagLibrary().onAnalysis(listener);
    return () => {
      subscription.remove();
    };
  },
  deleteLibraryFile: (relativePath) =>
    getKitbagLibrary().deleteLibraryFile(relativePath),
  deleteSongFolder: (folderName) =>
    getKitbagLibrary().deleteSongFolder(folderName),
  checkStemBundle: (uri, isFolder) =>
    getKitbagLibrary().checkStemBundle(uri, isFolder),
  importStemBundle: (uri, isFolder) =>
    getKitbagLibrary().importStemBundle(uri, isFolder),
  listStemFolders: () => getKitbagLibrary().listStemFolders(),
  deleteStemFolder: (folderName) =>
    getKitbagLibrary().deleteStemFolder(folderName),
  fileAvailability,
  onDataFolderChanged: watchDataFolder,
};

const openSong: OpenSong = {
  id: () => songPlayerStore.getState().songId,
  onChange: (listener) =>
    songPlayerStore.subscribe((state, previous) => {
      if (state.songId !== previous.songId) listener();
    }),
};

configureSongLibrary({ records, files, openSong });

export function useSongLibraryAnalysis(): void {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let unmounted = false;
    songLibraryStore
      .getState()
      .start()
      .then((stop) => {
        if (unmounted) stop();
        else unsubscribe = stop;
      })
      .catch((error: unknown) => {
        console.warn('[kitbag] song analysis start failed', error);
      });
    return () => {
      unmounted = true;
      unsubscribe?.();
    };
  }, []);
}
