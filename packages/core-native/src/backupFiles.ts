import { getKitbagLibrary, type PickedBackup } from './NativeKitbagLibrary';

export const BACKUP_FILES_AVAILABLE = true;

export function pickBackup(): Promise<PickedBackup | null> {
  return getKitbagLibrary().pickBackup();
}

export function shareBackup(fileName: string, contents: string): Promise<void> {
  return getKitbagLibrary().shareBackup(fileName, contents);
}
