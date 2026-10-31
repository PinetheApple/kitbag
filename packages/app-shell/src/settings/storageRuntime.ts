import { DATABASE_NAME } from '@kitbag/core-db';
import { missingFiles, storageReport } from '@kitbag/core-native';
import {
  findMissingRows,
  removeMissingRows,
  songLibraryStore,
  storedRowFiles,
  type MissingFilesSource,
} from '@kitbag/core-state';

import { getDatabase } from '@/runtime/database';

import type { StorageDeps } from './storageModel.ts';

const source: MissingFilesSource = {
  storedFiles: () => storedRowFiles(getDatabase().songLibrary),
  missingFiles,
};

export const storageDeps: StorageDeps = {
  readReport: async () => storageReport(DATABASE_NAME),
  findMissing: () => findMissingRows(source),
  removeMissing: () =>
    removeMissingRows({
      ...source,
      deleteRow: (row) => songLibraryStore.getState().deleteRow(row),
    }),
};
