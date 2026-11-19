import { Platform } from 'react-native';

import { getKitbagLibrary, type PickedBackup } from './NativeKitbagLibrary';

export function backupFilesAvailable(): boolean {
  return Platform.OS === 'android';
}

export function pickBackup(): Promise<PickedBackup | null> {
  return getKitbagLibrary().pickBackup();
}

export function saveBackup(
  fileName: string,
  contents: string,
): Promise<boolean> {
  return getKitbagLibrary().saveBackup(fileName, contents);
}

export function saveDatabaseCopy(
  databaseName: string,
  fileName: string,
): Promise<boolean> {
  return getKitbagLibrary().saveDatabaseCopy(databaseName, fileName);
}

export function shareBackup(fileName: string, contents: string): Promise<void> {
  return getKitbagLibrary().shareBackup(fileName, contents);
}
