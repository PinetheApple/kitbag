import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { songs } from './schema';
import { createSongLibraryRepository } from './song-library-repository';
import { openTestDatabase } from './sqlite.test-helper';

const SLOWED = 0.9;
const FULL_SPEED = 1;

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

async function importedSong() {
  const handle = openTestDatabase();
  open.push(handle);
  const library = createSongLibraryRepository(handle);
  const id = await library.insertSong({
    uuid: 'uuid-e',
    title: 'Everlong',
    artist: '',
    filePath: 'songs/uuid-e/Everlong.mp3',
    durationSec: 250,
    format: 'mp3',
  });
  return { handle, library, id };
}

async function storedSpeed(
  handle: ReturnType<typeof openTestDatabase>,
  id: number,
) {
  const [row] = await handle.db
    .select({ value: songs.speed })
    .from(songs)
    .where(eq(songs.id, id));
  return row?.value;
}

describe('song speed', () => {
  it('reads a song never slowed at full speed', async () => {
    const { library, id } = await importedSong();
    expect((await library.readSong(id))?.speed).toBe(FULL_SPEED);
  });

  it('saves a speed and reads it back', async () => {
    const { library, id } = await importedSong();
    await library.saveSongSpeed(id, SLOWED);
    expect((await library.readSong(id))?.speed).toBe(SLOWED);
  });

  it.each([0, -0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %s and stores nothing',
    async (speed) => {
      const { handle, library, id } = await importedSong();
      await expect(library.saveSongSpeed(id, speed)).rejects.toThrow(
        RangeError,
      );
      expect(await storedSpeed(handle, id)).toBe(FULL_SPEED);
    },
  );
});
