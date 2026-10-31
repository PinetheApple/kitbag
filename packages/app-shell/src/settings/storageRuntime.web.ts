import { DATABASE_NAME } from '@kitbag/core-db';
import { storageReport } from '@kitbag/core-native';

import type { StorageDeps } from './storageModel.ts';

export const storageDeps: StorageDeps = {
  readReport: () => storageReport(DATABASE_NAME),
  findMissing: () => Promise.resolve([]),
  removeMissing: () => Promise.resolve(),
};
