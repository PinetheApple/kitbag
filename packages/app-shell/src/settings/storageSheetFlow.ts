export type StorageSheetKind = 'none' | 'storage' | 'confirm';

export type StorageSheetEvent =
  'open' | 'askRemove' | 'remove' | 'cancelRemove' | 'dismiss';

export function nextStorageSheet(
  kind: StorageSheetKind,
  event: StorageSheetEvent,
): StorageSheetKind {
  switch (event) {
    case 'open':
      return 'storage';
    case 'askRemove':
      return kind === 'storage' ? 'confirm' : kind;
    case 'remove':
    case 'cancelRemove':
      return kind === 'confirm' ? 'storage' : kind;
    case 'dismiss':
      return 'none';
  }
}

export function showsRemoveMissing(missingCount: number): boolean {
  return missingCount > 0;
}
