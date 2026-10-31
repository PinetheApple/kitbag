import type * as Native from './libraryStorage.ts';
import type { StorageReport } from './NativeKitbagLibrary';

const WEB_STORAGE_REPORT: StorageReport = {
  libraryAudio: { songs: 0, bytes: 0 },
  stemSets: { count: 0, bytes: 0 },
  database: { bytes: 0 },
  location: '',
};

export const storageReport: typeof Native.storageReport = () =>
  Promise.resolve(WEB_STORAGE_REPORT);

export const missingFiles: typeof Native.missingFiles = () =>
  Promise.resolve([]);
