import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import type { LibraryStore } from '../library/store.ts';
import type { SongLibraryStore } from '../songLibrary/store.ts';
import type { PlayOrderStore } from './store.ts';
import { bindStemSetRemovals } from './stemSetRemovals.ts';

const stems = (...ids: number[]) =>
  ids.map((id) => ({ kind: 'stems', id }) as SongLibraryStore['rows'][number]);
const song = (id: number) =>
  ({ kind: 'song', id }) as SongLibraryStore['rows'][number];

function setup() {
  const songs = createStore(
    () => ({ rows: stems(1, 2) }) as unknown as SongLibraryStore,
  );
  const libraryRefresh = vi.fn(() => Promise.resolve());
  const orderRefresh = vi.fn(() => Promise.resolve());
  const library = createStore(
    () => ({ refresh: libraryRefresh }) as unknown as LibraryStore,
  );
  const order = createStore(
    () => ({ refresh: orderRefresh }) as unknown as PlayOrderStore,
  );
  bindStemSetRemovals(songs, library, order);
  return { songs, libraryRefresh, orderRefresh };
}

describe('stem set removals', () => {
  it('rereads the setlists and the queue when a stem song leaves the library', () => {
    const { songs, libraryRefresh, orderRefresh } = setup();
    songs.setState({ rows: stems(2) });
    expect(libraryRefresh).toHaveBeenCalledOnce();
    expect(orderRefresh).toHaveBeenCalledOnce();
  });

  it('leaves them alone when songs are only added', () => {
    const { songs, libraryRefresh, orderRefresh } = setup();
    songs.setState({ rows: [...stems(1, 2, 3), song(1)] });
    expect(libraryRefresh).not.toHaveBeenCalled();
    expect(orderRefresh).not.toHaveBeenCalled();
  });
});
