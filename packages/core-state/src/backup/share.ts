import { CATEGORIES } from '@kitbag/core-db';

import { getBackup, type BackupDeps } from './runtime.ts';

export const LIBRARY_BACKUP_FILE_NAME = 'kitbag_export.json';

const SETLIST_FILE_PREFIX = 'kitbag_setlist';
const FALLBACK_SLUG = 'setlist';
const FILE_EXTENSION = '.json';
const MAX_SLUG_LENGTH = 64;

export function setlistBackupFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
  return `${SETLIST_FILE_PREFIX}_${slug === '' ? FALLBACK_SLUG : slug}${FILE_EXTENSION}`;
}

export async function shareLibraryBackup(
  deps: BackupDeps = getBackup(),
): Promise<void> {
  const contents = await deps.service().export(CATEGORIES);
  await deps.share(LIBRARY_BACKUP_FILE_NAME, contents);
}

export async function shareSetlist(
  setlist: { readonly uuid: string; readonly name: string },
  deps: BackupDeps = getBackup(),
): Promise<void> {
  const contents = await deps.service().exportSetlist(setlist.uuid);
  await deps.share(setlistBackupFileName(setlist.name), contents);
}
