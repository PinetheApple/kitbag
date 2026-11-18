import { describe, expect, it } from 'vitest';

import {
  importOne,
  setup,
  SONG_PATH,
} from '../songLibrary/store.test-helper.ts';
import { removeMissingRows } from '../storage/missingRows.ts';
import { BARS, fakeSongRuntime, songStore } from './store.test-helper.ts';

async function playingFromTheLibrary() {
  const { store: library } = setup();
  const row = await importOne(library);
  const fake = fakeSongRuntime();
  const player = songStore(fake, undefined, library);
  const session = player.getState().open(row.id, BARS);
  await session.loaded;
  session.hold.release();
  player.getState().togglePlay();
  return { library, row, player, fake };
}

type Playing = Awaited<ReturnType<typeof playingFromTheLibrary>>;

function deleteOnSongs({ library, row }: Playing) {
  return library.getState().deleteRow(row);
}

function deleteFromStorage({ library, row }: Playing) {
  return removeMissingRows({
    storedFiles: () => Promise.resolve([{ row, audioPaths: [SONG_PATH] }]),
    missingFiles: () => Promise.resolve([SONG_PATH]),
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
    expect(playing.player.getState().songId).toBeNull();
    expect(commands.mixerStop).toHaveBeenCalledOnce();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
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
