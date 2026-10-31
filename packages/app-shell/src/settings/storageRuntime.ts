import { DATABASE_NAME } from '@kitbag/core-db';
import { missingFiles, storageReport } from '@kitbag/core-native';
import {
  findMissingRows,
  removeMissingRows,
  songLibraryStore,
  storedRowFiles,
  type MissingFilesSource,
} from '@kitbag/core-state';

import { getDatabase } from '../runtime/database.ts';

import type { StorageDeps } from './storageModel.ts';

const source: MissingFilesSource = {
  storedFiles: () => storedRowFiles(getDatabase().songLibrary),
  missingFiles,
};

// Settings reports a failed removal itself; the Songs screen must not repeat it.
function clearDeleteNotice(): void {
  const library = songLibraryStore.getState();
  if (library.notice?.kind === 'deleteFailed') library.dismissNotice();
}

export const storageDeps: StorageDeps = {
  readReport: () => storageReport(DATABASE_NAME),
  findMissing: () => findMissingRows(source),
  removeMissing: () =>
    removeMissingRows({
      ...source,
      deleteRow: (row) => songLibraryStore.getState().deleteRow(row),
    }).then(clearDeleteNotice),
};
