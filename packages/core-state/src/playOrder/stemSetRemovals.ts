import type { LibraryRow } from '@kitbag/core-db';
import type { StoreApi } from 'zustand/vanilla';

import type { LibraryStore } from '../library/store.ts';
import type { SongLibraryStore } from '../songLibrary/store.ts';
import type { PlayOrderStore } from './store.ts';

function stemSetIds(rows: readonly LibraryRow[]): Set<number> {
  return new Set(rows.flatMap((row) => (row.kind === 'stems' ? [row.id] : [])));
}

function lostAny(before: Set<number>, after: Set<number>): boolean {
  return [...before].some((id) => !after.has(id));
}

export function bindStemSetRemovals(
  songs: StoreApi<SongLibraryStore>,
  library: StoreApi<LibraryStore>,
  order: StoreApi<PlayOrderStore>,
): () => void {
  return songs.subscribe((next, prev) => {
    if (next.rows === prev.rows) return;
    if (!lostAny(stemSetIds(prev.rows), stemSetIds(next.rows))) return;
    void library.getState().refresh();
    order
      .getState()
      .refresh()
      .catch((error: unknown) => {
        console.warn('[kitbag] play queue refresh failed', error);
      });
  });
}
