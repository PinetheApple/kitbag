import { getKitbagLibrary, type StorageReport } from './NativeKitbagLibrary';

export function storageReport(databaseName: string): Promise<StorageReport> {
  return getKitbagLibrary().storageReport(databaseName);
}

export function missingFiles(
  relativePaths: readonly string[],
): Promise<readonly string[]> {
  return getKitbagLibrary().missingFiles(relativePaths);
}
