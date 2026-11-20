import type { LibraryRow } from '@kitbag/core-db';
import type { StoreApi } from 'zustand/vanilla';

import type { LibraryStore } from '../library/store.ts';
import { rowKey } from '../songLibrary/rowKey.ts';
import type { SongLibraryStore } from '../songLibrary/store.ts';
import { heardStore, type HeardState } from './heard.ts';
import type { PlayOrderStore } from './store.ts';

function rowKeys(rows: readonly LibraryRow[]): Set<string> {
  return new Set(rows.map(rowKey));
}

function lostAny(before: Set<string>, after: Set<string>): boolean {
  return [...before].some((key) => !after.has(key));
}

export function bindLibraryRemovals(
  songs: StoreApi<SongLibraryStore>,
  library: StoreApi<LibraryStore>,
  order: StoreApi<PlayOrderStore>,
  heard: StoreApi<HeardState> = heardStore,
): () => void {
  return songs.subscribe((next, prev) => {
    if (next.rows === prev.rows) return;
    const kept = rowKeys(next.rows);
    if (!lostAny(rowKeys(prev.rows), kept)) return;
    heard.setState({
      heard: heard
        .getState()
        .heard.filter(({ song }) => kept.has(rowKey(song))),
    });
    void library.getState().refresh();
    order
      .getState()
      .refresh()
      .catch((error: unknown) => {
        console.warn('[kitbag] play queue refresh failed', error);
      });
  });
}
