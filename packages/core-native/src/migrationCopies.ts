import { getKitbagLibrary } from './NativeKitbagLibrary';

function required(done: boolean, action: string): void {
  if (!done) throw new Error(`Could not ${action} (see the native log)`);
}

export function databaseFreeBytes(databaseName: string): number {
  const bytes = getKitbagLibrary().databaseFreeBytes(databaseName);
  required(bytes >= 0, `measure free space for ${databaseName}`);
  return bytes;
}

export function removeDatabaseCopy(
  databaseName: string,
  fileName: string,
): void {
  required(
    getKitbagLibrary().removeDatabaseCopy(databaseName, fileName),
    `remove ${fileName}`,
  );
}

export function replaceDatabaseCopy(
  databaseName: string,
  partName: string,
  fileName: string,
): void {
  required(
    getKitbagLibrary().replaceDatabaseCopy(databaseName, partName, fileName),
    `move ${partName} to ${fileName}`,
  );
}
