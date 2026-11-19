import type { LibraryRow } from '@kitbag/core-db';

import { checkRowFiles, type RowFiles } from '../storage/missingRows.ts';
import { storedRowFiles } from '../storage/storedRowFiles.ts';
import type { SongLibraryDeps } from './store.ts';
import { warn, type SetState } from './storeSupport.ts';

export type RowFilesByKey = ReadonlyMap<string, RowFiles>;
export type RowPathsByKey = ReadonlyMap<string, readonly string[]>;

export function rowKey(row: Pick<LibraryRow, 'kind' | 'id'>): string {
  return `${row.kind}:${String(row.id)}`;
}

export function rowFilesOf(
  byKey: RowFilesByKey,
  row: Pick<LibraryRow, 'kind' | 'id'>,
): RowFiles | null {
  return byKey.get(rowKey(row)) ?? null;
}

function coalesced(work: () => Promise<void>): () => Promise<void> {
  let current: Promise<void> | null = null;
  let again = false;
  const drain = async () => {
    await work();
    while (again) {
      again = false;
      await work();
    }
    current = null;
  };
  return () => {
    if (current !== null) {
      again = true;
      return current;
    }
    current = drain();
    return current;
  };
}

export function availabilityRefresher(
  deps: SongLibraryDeps,
  set: SetState,
  onRootReturned: () => Promise<void>,
): () => Promise<void> {
  let rootAvailable: boolean | null = null;
  return coalesced(async () => {
    try {
      const stored = await storedRowFiles(deps.records());
      const check = await checkRowFiles({
        storedFiles: () => Promise.resolve(stored),
        fileAvailability: deps.files().fileAvailability,
      });
      set({
        rowFiles: new Map(
          check.rows.map(({ row, files }) => [rowKey(row), files]),
        ),
        rowPaths: new Map(
          stored.map(({ row, audioPaths }) => [rowKey(row), audioPaths]),
        ),
      });
      const returned = rootAvailable === false && check.rootAvailable;
      rootAvailable = check.rootAvailable;
      if (returned) await onRootReturned();
    } catch (error) {
      warn('library file availability unread', error);
    }
  });
}
