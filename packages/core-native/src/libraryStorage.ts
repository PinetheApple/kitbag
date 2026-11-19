import {
  getKitbagLibrary,
  type LibraryAvailability,
  type StorageReport,
} from './NativeKitbagLibrary';

export function storageReport(databaseName: string): Promise<StorageReport> {
  return getKitbagLibrary().storageReport(databaseName);
}

export function missingFiles(
  relativePaths: readonly string[],
): Promise<LibraryAvailability> {
  return getKitbagLibrary().missingFiles(relativePaths);
}

export function watchDataFolder(listener: () => void): () => void {
  const subscription = getKitbagLibrary().onDataFolderChanged(listener);
  return () => {
    subscription.remove();
  };
}
