import type { PickedDocument } from '@kitbag/core-native';

import { BACKUP_FILE_EXTENSION } from '../backup/share.ts';
import { isStemArchive, mediaType } from '../songLibrary/logic.ts';

export type IntakePlan =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'restore';
      readonly backup: PickedDocument;
      readonly skipped: readonly PickedDocument[];
    }
  | {
      readonly kind: 'import';
      readonly docs: readonly PickedDocument[];
      readonly songs: readonly PickedDocument[];
      readonly stemSongs: readonly PickedDocument[];
    };

function isBackup(doc: PickedDocument, backupMimeType: string): boolean {
  return (
    mediaType(doc.mimeType) === backupMimeType ||
    doc.name.toLocaleLowerCase().endsWith(BACKUP_FILE_EXTENSION)
  );
}

export function planIntake(
  items: readonly PickedDocument[],
  backupMimeType: string,
): IntakePlan {
  const backup = items.find((doc) => isBackup(doc, backupMimeType));
  if (backup !== undefined)
    return {
      kind: 'restore',
      backup,
      skipped: items.filter((doc) => doc !== backup),
    };
  if (items.length === 0) return { kind: 'none' };
  return {
    kind: 'import',
    docs: items,
    songs: items.filter((doc) => !isStemArchive(doc)),
    stemSongs: items.filter(isStemArchive),
  };
}
