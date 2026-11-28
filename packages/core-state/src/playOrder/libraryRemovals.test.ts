import type { QueuedSong } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import type { LibraryStore } from '../library/store.ts';
import { settle } from '../songLibrary/store.test-helper.ts';
import type { SongLibraryStore } from '../songLibrary/store.ts';
import type { PlayOrderStore } from './store.ts';
import type { HeardState } from './heard.ts';
import type { RepeatState } from './repeat.ts';
import type { ShownPlayer } from './shownPlayer.ts';
import { bindLibraryRemovals } from './libraryRemovals.ts';

const stems = (...ids: number[]) =>
  ids.map((id) => ({ kind: 'stems', id }) as SongLibraryStore['rows'][number]);
const song = (id: number) =>
  ({ kind: 'song', id }) as SongLibraryStore['rows'][number];

const STEMS_1: QueuedSong = { kind: 'stems', id: 1 };
const STEMS_2: QueuedSong = { kind: 'stems', id: 2 };
const SONG_1: QueuedSong = { kind: 'song', id: 1 };
const NEXT_ID = 9;

interface Given {
  readonly shown?: QueuedSong | null;
  readonly hasNext?: boolean;
  readonly wasPlaying?: boolean;
}

function setup({
  shown = null,
  hasNext = false,
  wasPlaying = false,
}: Given = {}) {
  const songs = createStore(
    () =>
      ({
        rows: [...stems(1, 2), song(1)],
        deletedSong: null,
      }) as unknown as SongLibraryStore,
  );
  const libraryRefresh = vi.fn(() => Promise.resolve());
  const orderRefresh = vi.fn(() => Promise.resolve());
  const library = createStore(
    () => ({ refresh: libraryRefresh }) as unknown as LibraryStore,
  );
  const order = createStore(
    () => ({ refresh: orderRefresh }) as unknown as PlayOrderStore,
  );
  const heard = createStore<HeardState>(() => ({
    heard: [
      { song: STEMS_1, setlistItemId: null },
      { song: SONG_1, setlistItemId: null },
    ],
  }));
  const repeat = createStore<Pick<RepeatState, 'played'>>(() => ({
    played: [STEMS_1, SONG_1],
  }));
  let showing = shown;
  const player = {
    shown: () => showing,
    pauseIfSounding: vi.fn(() => wasPlaying),
    hasNext: vi.fn(() => hasNext),
    next: vi.fn<ShownPlayer['next']>((kind) => {
      showing = { kind, id: NEXT_ID };
    }),
    close: vi.fn(() => {
      showing = null;
    }),
  };
  bindLibraryRemovals(songs, library, order, { heard, repeat, player });
  return { songs, libraryRefresh, orderRefresh, heard, repeat, player };
}

describe('library removals', () => {
  it('rereads the setlists and the queue when a deleted song comes back', () => {
    const { songs, libraryRefresh, orderRefresh } = setup();
    const deletedSong = { song: { row: { id: 1 } } };
    songs.setState({
      rows: stems(1, 2),
      deletedSong,
    } as unknown as SongLibraryStore);
    songs.setState({ deletedSong: null });
    songs.setState({ rows: [...stems(1, 2), song(1)] });
    expect(libraryRefresh).toHaveBeenCalledTimes(2);
    expect(orderRefresh).toHaveBeenCalledTimes(2);
  });

  it('rereads the setlists and the queue when a stem song leaves the library', () => {
    const { songs, libraryRefresh, orderRefresh } = setup();
    songs.setState({ rows: [...stems(2), song(1)] });
    expect(libraryRefresh).toHaveBeenCalledOnce();
    expect(orderRefresh).toHaveBeenCalledOnce();
  });

  it('rereads the queue when a queued single song is deleted', () => {
    const { songs, orderRefresh } = setup();
    songs.setState({ rows: stems(1, 2) });
    expect(orderRefresh).toHaveBeenCalledOnce();
  });

  it('forgets a deleted song from the songs heard, so Previous skips it', () => {
    const { songs, heard } = setup();
    songs.setState({ rows: [...stems(2), song(1)] });
    expect(heard.getState().heard).toEqual([
      { song: SONG_1, setlistItemId: null },
    ]);
  });

  it('forgets a deleted song from the repeat round, so Repeat all skips it', () => {
    const { songs, repeat } = setup();
    songs.setState({ rows: stems(1, 2) });
    expect(repeat.getState().played).toEqual([STEMS_1]);
  });

  it('leaves them alone when songs are only added', () => {
    const { songs, libraryRefresh, orderRefresh } = setup();
    songs.setState({ rows: [...stems(1, 2, 3), song(1), song(2)] });
    expect(libraryRefresh).not.toHaveBeenCalled();
    expect(orderRefresh).not.toHaveBeenCalled();
  });
});

const KINDS = [
  ['stem song', STEMS_1, [...stems(2), song(1)]],
  ['single song', SONG_1, stems(1, 2)],
] as const;

describe('deleting the song the mini-player shows', () => {
  it.each(KINDS)(
    'pauses the %s before the queue is reread',
    async (_kind, shown, left) => {
      const { songs, player, orderRefresh } = setup({
        shown,
        hasNext: true,
        wasPlaying: true,
      });
      let reread: () => void = () => undefined;
      orderRefresh.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            reread = resolve;
          }),
      );
      songs.setState({ rows: left });
      expect(player.pauseIfSounding).toHaveBeenCalledExactlyOnceWith(
        shown.kind,
      );
      await settle();
      expect(player.next).not.toHaveBeenCalled();
      reread();
      await settle();
      expect(player.next).toHaveBeenCalledOnce();
    },
  );

  it.each(KINDS)(
    'hands the next song over playing once the playing %s is gone',
    async (_kind, shown, left) => {
      const { songs, player } = setup({
        shown,
        hasNext: true,
        wasPlaying: true,
      });
      songs.setState({ rows: left });
      await settle();
      expect(player.next).toHaveBeenCalledExactlyOnceWith(shown.kind, true);
      expect(player.close).not.toHaveBeenCalled();
      expect(player.shown()).not.toEqual(shown);
    },
  );

  it.each(KINDS)(
    'opens the next song paused once the paused %s is gone',
    async (_kind, shown, left) => {
      const { songs, player } = setup({ shown, hasNext: true });
      songs.setState({ rows: left });
      await settle();
      expect(player.next).toHaveBeenCalledExactlyOnceWith(shown.kind, false);
    },
  );

  it.each(KINDS)(
    'closes the mini-player when nothing follows the %s',
    async (_kind, shown, left) => {
      const { songs, player } = setup({ shown });
      songs.setState({ rows: left });
      await settle();
      expect(player.close).toHaveBeenCalledOnce();
      expect(player.next).not.toHaveBeenCalled();
      expect(player.shown()).toBeNull();
    },
  );

  it('moves on once when a queued song is deleted right after the shown one', async () => {
    const { songs, player } = setup({ shown: STEMS_1, hasNext: true });
    songs.setState({ rows: [...stems(2), song(1)] });
    songs.setState({ rows: [song(1)] });
    await settle();
    expect(player.pauseIfSounding).toHaveBeenCalledOnce();
    expect(player.next).toHaveBeenCalledExactlyOnceWith(STEMS_1.kind, false);
    expect(player.close).not.toHaveBeenCalled();
  });

  it('keeps the shown song when another song is deleted', async () => {
    const { songs, player } = setup({ shown: STEMS_1, hasNext: true });
    songs.setState({ rows: [...stems(1), song(1)] });
    await settle();
    expect(player.pauseIfSounding).not.toHaveBeenCalled();
    expect(player.next).not.toHaveBeenCalled();
    expect(player.close).not.toHaveBeenCalled();
    expect(player.shown()).toEqual(STEMS_1);
  });
});

describe('Undo of a deleted song', () => {
  const deleteSong1 = (songs: ReturnType<typeof setup>['songs']) => {
    songs.setState({ rows: stems(1, 2) });
    songs.setState({
      deletedSong: { song: { row: { id: 1 } } },
    } as unknown as SongLibraryStore);
  };
  const undo = (
    songs: ReturnType<typeof setup>['songs'],
    rows = [...stems(1, 2), song(1)],
  ) => {
    songs.setState({ deletedSong: null });
    songs.setState({ rows });
  };

  it('brings back its place in the songs heard and the repeat round', () => {
    const { songs, heard, repeat } = setup();
    const before = {
      heard: heard.getState().heard,
      played: repeat.getState().played,
    };
    deleteSong1(songs);
    undo(songs);
    expect(heard.getState().heard).toEqual(before.heard);
    expect(repeat.getState().played).toEqual(before.played);
  });

  it('keeps what was heard during the Undo window after it', () => {
    const { songs, heard, repeat } = setup();
    deleteSong1(songs);
    const next = { song: STEMS_2, setlistItemId: null };
    heard.setState({ heard: [...heard.getState().heard, next] });
    repeat.setState({ played: [...repeat.getState().played, STEMS_2] });
    undo(songs);
    expect(heard.getState().heard).toEqual([
      { song: STEMS_1, setlistItemId: null },
      { song: SONG_1, setlistItemId: null },
      next,
    ]);
    expect(repeat.getState().played).toEqual([STEMS_1, SONG_1, STEMS_2]);
  });

  it('brings back only the song that came back', () => {
    const { songs, heard, repeat } = setup();
    songs.setState({ rows: stems(2) });
    songs.setState({
      deletedSong: { song: { row: { id: 1 } } },
    } as unknown as SongLibraryStore);
    undo(songs, [...stems(2), song(1)]);
    expect(heard.getState().heard).toEqual([
      { song: SONG_1, setlistItemId: null },
    ]);
    expect(repeat.getState().played).toEqual([SONG_1]);
  });

  it('leaves a history cleared during the Undo window cleared', () => {
    const { songs, heard, repeat } = setup();
    deleteSong1(songs);
    heard.setState({ heard: [] });
    repeat.setState({ played: [] });
    undo(songs);
    expect(heard.getState().heard).toEqual([]);
    expect(repeat.getState().played).toEqual([]);
  });

  it('brings nothing back when Undo is dismissed', () => {
    const { songs, heard } = setup();
    deleteSong1(songs);
    songs.setState({ deletedSong: null });
    songs.setState({ rows: [...stems(1, 2, 3)] });
    expect(heard.getState().heard).toEqual([
      { song: STEMS_1, setlistItemId: null },
    ]);
  });
});
