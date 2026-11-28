import type { LibraryRow } from '@kitbag/core-db';
import type { StoreApi } from 'zustand/vanilla';

import type { LibraryStore } from '../library/store.ts';
import { rowKey } from '../songLibrary/rowKey.ts';
import type { SongLibraryStore } from '../songLibrary/store.ts';
import { moveOffDeleted } from './deletedSong.ts';
import { heardStore, type HeardState } from './heard.ts';
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

function forget({ heard, repeat }: RemovalFollowers, kept: Set<string>): void {
  heard.setState({
    heard: heard.getState().heard.filter(({ song }) => kept.has(rowKey(song))),
  });
  repeat.setState({
    played: repeat.getState().played.filter((song) => kept.has(rowKey(song))),
  });
}

export function bindLibraryRemovals(
  songs: StoreApi<SongLibraryStore>,
  library: StoreApi<LibraryStore>,
  order: StoreApi<PlayOrderStore>,
  follow: RemovalFollowers = followers,
): () => void {
  let undoing: string | null = null;
  return songs.subscribe((next, prev) => {
    if (prev.deletedSong !== null && next.deletedSong === null)
      undoing = rowKey({ kind: 'song', id: prev.deletedSong.song.row.id });
    if (next.rows === prev.rows) return;
    const kept = rowKeys(next.rows);
    const had = rowKeys(prev.rows);
    if (!lostAny(had, kept)) {
      if (undoing !== null && kept.has(undoing)) {
        undoing = null;
        void rereadStores(library, order);
      }
      return;
    }
    forget(follow, kept);
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
