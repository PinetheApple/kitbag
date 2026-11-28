import { afterEach, describe, expect, it } from 'vitest';

import { CATEGORIES } from './backup-format';
import { backupDatabase } from './backup.test-helper';
import { preferences } from './schema';
import { createSongLibraryRepository } from './song-library-repository';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

async function withSongs(...uuids: string[]) {
  const handle = openTestDatabase();
  open.push(handle);
  const records = createSongLibraryRepository(handle);
  const ids = [];
  for (const uuid of uuids)
    ids.push(
      await records.insertSong({
        uuid,
        title: uuid,
        artist: '',
        filePath: `songs/${uuid}/a.mp3`,
        durationSec: 1,
        format: 'mp3',
      }),
    );
  return { handle, records, ids };
}

describe('song files held until deleted', () => {
  it('holds the files of a deleted song', async () => {
    const { records, ids } = await withSongs('a');
    const [id] = ids;
    if (id === undefined) throw new Error('no song');
    await records.deleteSong(id);
    expect(await records.listHeldSongFiles()).toEqual([
      { songId: id, uuid: 'a', filePath: 'songs/a/a.mp3', waveformPath: null },
    ]);
  });

  it('lets go of them when the song is restored', async () => {
    const { records, ids } = await withSongs('a', 'b');
    const [a, b] = ids;
    if (a === undefined || b === undefined) throw new Error('no songs');
    const deleted = await records.deleteSong(a);
    await records.deleteSong(b);
    if (deleted === undefined) throw new Error('not deleted');
    await records.restoreSong(deleted);
    expect(await records.listHeldSongFiles()).toMatchObject([{ songId: b }]);
  });

  it('lets go of one song without touching the others', async () => {
    const { records, ids } = await withSongs('a', 'b');
    for (const id of ids) await records.deleteSong(id);
    await records.releaseSongFiles(ids[0] ?? -1);
    expect(await records.listHeldSongFiles()).toMatchObject([
      { songId: ids[1] },
    ]);
  });

  it.each([
    ['not JSON', '{'],
    ['not a list', '{"songId":1}'],
    ['a malformed entry', '[{"songId":"1","uuid":"a"}]'],
  ])(
    'reads a stored value that is %s as nothing held, and replaces it',
    async (_label, value) => {
      const { handle, records, ids } = await withSongs('a');
      await handle.db
        .insert(preferences)
        .values({ key: 'held_song_files', value });
      expect(await records.listHeldSongFiles()).toEqual([]);
      await records.deleteSong(ids[0] ?? -1);
      expect(await records.listHeldSongFiles()).toMatchObject([
        { songId: ids[0] },
      ]);
    },
  );

  it('is never written into a backup', async () => {
    const { handle, records, ids } = await withSongs('a');
    await records.deleteSong(ids[0] ?? -1);
    const text = await backupDatabase(handle).backup.export([...CATEGORIES]);
    expect(text).not.toContain('held_song_files');
    expect(text).not.toContain('songs/a/a.mp3');
  });
});
