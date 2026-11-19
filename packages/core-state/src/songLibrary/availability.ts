import type { LibraryRow } from '@kitbag/core-db';

import { checkRowFiles, type RowFiles } from '../storage/missingRows.ts';
import { storedRowFiles } from '../storage/storedRowFiles.ts';
import type { SongLibraryDeps } from './store.ts';
import { warn, type SetState } from './storeSupport.ts';

export type RowFilesByKey = ReadonlyMap<string, RowFiles>;

export function rowKey(row: Pick<LibraryRow, 'kind' | 'id'>): string {
  return `${row.kind}:${String(row.id)}`;
}

export function rowFilesOf(
  byKey: RowFilesByKey,
  row: Pick<LibraryRow, 'kind' | 'id'>,
): RowFiles | null {
  return byKey.get(rowKey(row)) ?? null;
}

export function availabilityRefresher(
  deps: SongLibraryDeps,
  set: SetState,
): () => Promise<void> {
  let latest = 0;
  return async () => {
    latest += 1;
    const request = latest;
    try {
      const { rows } = await checkRowFiles({
        storedFiles: () => storedRowFiles(deps.records()),
        missingFiles: deps.files().missingFiles,
      });
      if (request !== latest) return;
      set({
        rowFiles: new Map(rows.map(({ row, files }) => [rowKey(row), files])),
      });
    } catch (error) {
      warn('library file availability unread', error);
    }
  };
}
