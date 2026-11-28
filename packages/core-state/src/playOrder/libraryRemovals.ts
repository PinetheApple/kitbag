import type { LibraryRow, QueuedSong } from '@kitbag/core-db';
import type { StoreApi } from 'zustand/vanilla';

import type { LibraryStore } from '../library/store.ts';
import { rowKey } from '../songLibrary/rowKey.ts';
import type { SongLibraryStore } from '../songLibrary/store.ts';
import { moveOffDeleted } from './deletedSong.ts';
import { heardStore, type HeardSong, type HeardState } from './heard.ts';
import { repeatStore, type RepeatState } from './repeat.ts';
import { shownPlayer, type ShownPlayer } from './shownPlayer.ts';
import type { PlayOrderStore } from './store.ts';

export interface RemovalFollowers {
  readonly heard: StoreApi<HeardState>;
  readonly repeat: StoreApi<Pick<RepeatState, 'played'>>;
  readonly player: ShownPlayer;
}

const followers: RemovalFollowers = {
  heard: heardStore,
  repeat: repeatStore,
  player: shownPlayer,
};

function rowKeys(rows: readonly LibraryRow[]): Set<string> {
  return new Set(rows.map(rowKey));
}

function lostNow(before: Set<string>, after: Set<string>, key: string) {
  return before.has(key) && !after.has(key);
}

function lostAny(before: Set<string>, after: Set<string>): boolean {
  return [...before].some((key) => !after.has(key));
}

function rereadStores(
  library: StoreApi<LibraryStore>,
  order: StoreApi<PlayOrderStore>,
) {
  return Promise.allSettled([
    library.getState().refresh(),
    order
      .getState()
      .refresh()
      .catch((error: unknown) => {
        console.warn('[kitbag] play queue refresh failed', error);
      }),
  ]);
}

interface Dropped<T> {
  readonly before: readonly T[];
  readonly after: readonly T[];
}

interface Forgotten {
  readonly heard: Dropped<HeardSong>;
  readonly played: Dropped<QueuedSong>;
}

function dropped<T>(before: readonly T[], keep: (entry: T) => boolean) {
  return { before, after: before.filter(keep) };
}

// Restored only while what was left is still how the list starts; a list
// cleared or reordered since belongs to a new round the song was never part of.
function restored<T>(
  { before, after }: Dropped<T>,
  current: readonly T[],
  returning: (entry: T) => boolean,
): readonly T[] {
  if (after.some((entry, at) => current[at] !== entry)) return current;
  const left = new Set(after);
  const back = before.filter((entry) => left.has(entry) || returning(entry));
  return [...back, ...current.slice(after.length)];
}

function forget(
  { heard, repeat }: RemovalFollowers,
  kept: Set<string>,
): Forgotten {
  const forgotten = {
    heard: dropped(heard.getState().heard, ({ song }) =>
      kept.has(rowKey(song)),
    ),
    played: dropped(repeat.getState().played, (song) => kept.has(rowKey(song))),
  };
  heard.setState({ heard: forgotten.heard.after });
  repeat.setState({ played: forgotten.played.after });
  return forgotten;
}

function remember(
  { heard, repeat }: RemovalFollowers,
  forgotten: Forgotten,
  key: string,
): void {
  heard.setState({
    heard: restored(
      forgotten.heard,
      heard.getState().heard,
      ({ song }) => rowKey(song) === key,
    ),
  });
  repeat.setState({
    played: restored(
      forgotten.played,
      repeat.getState().played,
      (song) => rowKey(song) === key,
    ),
  });
}

export function bindLibraryRemovals(
  songs: StoreApi<SongLibraryStore>,
  library: StoreApi<LibraryStore>,
  order: StoreApi<PlayOrderStore>,
  follow: RemovalFollowers = followers,
): () => void {
  let undoing: string | null = null;
  let forgotten: Forgotten | null = null;
  return songs.subscribe((next, prev) => {
    if (prev.deletedSong !== null && next.deletedSong === null)
      undoing = rowKey({ kind: 'song', id: prev.deletedSong.song.row.id });
    if (next.rows === prev.rows) return;
    const kept = rowKeys(next.rows);
    const had = rowKeys(prev.rows);
    if (!lostAny(had, kept)) {
      if (undoing !== null && kept.has(undoing)) {
        if (forgotten !== null) remember(follow, forgotten, undoing);
        undoing = null;
        void rereadStores(library, order);
      }
      return;
    }
    forgotten = forget(follow, kept);
    const shown = follow.player.shown();
    const gone = shown !== null && lostNow(had, kept, rowKey(shown));
    const wasPlaying = gone && follow.player.pauseIfSounding(shown.kind);
    const reread = rereadStores(library, order);
    if (!gone) return;
    void reread.then(() => {
      moveOffDeleted(follow.player, shown, wasPlaying);
    });
  });
}
