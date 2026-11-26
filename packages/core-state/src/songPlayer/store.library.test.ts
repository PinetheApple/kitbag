import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import {
  importOne,
  setup,
  SONG_PATH,
} from '../songLibrary/store.test-helper.ts';
import type { LibraryStore } from '../library/store.ts';
import { bindLibraryRemovals } from '../playOrder/libraryRemovals.ts';
import { shownSongOf } from '../playOrder/nowPlaying.ts';
import type { PlayOrderStore } from '../playOrder/store.ts';
import { removeMissingRows } from '../storage/missingRows.ts';
import { BARS, fakeSongRuntime, songStore } from './store.test-helper.ts';

async function playingFromTheLibrary(queued = false) {
  const { store: library, records, files } = setup();
  const row = await importOne(library);
  const fake = fakeSongRuntime();
  fake.records.readSong.mockImplementation(() => records.readSong(row.id));
  const player = songStore(fake, undefined, library);
  const session = player.getState().open(row.id, BARS);
  await session.loaded;
  session.hold.release();
  player.getState().togglePlay();
  fake.engine.playing = true;
  const refresh = () => Promise.resolve();
  const next = vi.fn();
  bindLibraryRemovals(
    library,
    createStore(() => ({ refresh }) as unknown as LibraryStore),
    createStore(() => ({ refresh }) as unknown as PlayOrderStore),
    {
      heard: createStore(() => ({ heard: [] })),
      repeat: createStore(() => ({ played: [] })),
      player: {
        shown: () => shownSongOf(null, player.getState().songId),
        pauseIfSounding: () => player.getState().pauseIfSounding(),
        hasNext: () => queued,
        next,
        close: () => {
          player.getState().close();
        },
      },
    },
  );
  return { library, row, player, fake, next, files };
}

type Playing = Awaited<ReturnType<typeof playingFromTheLibrary>>;

function deleteOnSongs({ library, row }: Playing) {
  return library.getState().deleteRow(row);
}

function deleteFromStorage({ library, row }: Playing) {
  return removeMissingRows({
    storedFiles: () =>
      Promise.resolve([{ row, audioPaths: [SONG_PATH], waveformPaths: [] }]),
    fileAvailability: () =>
      Promise.resolve({
        missing: [SONG_PATH],
        unavailable: [],
        rootAvailable: true,
      }),
    deleteRow: (missing) => library.getState().deleteRow(missing),
  });
}

describe('the library changing the song that plays on behind the bar', () => {
  it.each([
    ['Songs', deleteOnSongs],
    ['Storage', deleteFromStorage],
  ])('stops it when %s deletes it', async (_from, remove) => {
    const playing = await playingFromTheLibrary();
    await remove(playing);
    const { commands } = playing.fake;
    await vi.waitFor(() => {
      expect(playing.player.getState().songId).toBeNull();
    });
    expect(commands.mixerStop).toHaveBeenCalledOnce();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
  });

  it('hands over to the next song when Songs deletes it', async () => {
    const playing = await playingFromTheLibrary(true);
    await deleteOnSongs(playing);
    await vi.waitFor(() => {
      expect(playing.next).toHaveBeenCalledExactlyOnceWith('song', true);
    });
  });

  it('pauses the song before its file is deleted', async () => {
    const playing = await playingFromTheLibrary(true);
    await deleteOnSongs(playing);
    const [paused] = playing.fake.commands.mixerPause.mock.invocationCallOrder;
    const { deleteSongFolder } = playing.files;
    expect(deleteSongFolder).toHaveBeenCalledOnce();
    expect(paused).toBeLessThan(
      deleteSongFolder.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('shows a rename on the bar', async () => {
    const { library, row, player } = await playingFromTheLibrary();
    await library.getState().renameRow(row, 'Monkey Wrench');
    expect(player.getState()).toMatchObject({
      status: 'ready',
      songId: row.id,
      title: 'Monkey Wrench',
    });
  });

  it('keeps playing when another song is deleted', async () => {
    const { library, row, player } = await playingFromTheLibrary();
    await library.getState().importSong();
    const other = library.getState().rows.find(({ id }) => id !== row.id);
    if (other === undefined) throw new Error('no second row');
    await library.getState().deleteRow(other);
    expect(player.getState().status).toBe('ready');
  });
});
