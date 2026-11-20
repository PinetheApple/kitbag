import { afterEach, describe, expect, it } from 'vitest';

import type { LinkedPresetValues } from './song-preset-repository';
import { createSongLibraryRepository } from './song-library-repository';
import { createSongPresetRepository } from './song-preset-repository';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup(options?: { foreignKeys: boolean }) {
  const handle = openTestDatabase(options);
  open.push(handle);
  return {
    library: createSongLibraryRepository(handle),
    presets: createSongPresetRepository(handle),
  };
}

const song = (title: string) => ({
  uuid: `uuid-${title}`,
  title,
  artist: 'Artist',
  filePath: `songs/uuid-${title}/${title}.mp3`,
  durationSec: 250.5,
  format: 'mp3',
});

const CLICK: LinkedPresetValues = {
  name: 'Everlong',
  bpm: 158,
  beatsPerBar: 4,
  subdivision: 1,
  accents: new Uint8Array([2, 1, 1, 1]),
  perAccentSounds: new Uint8Array([1, 5]),
  polyEnabled: false,
  polyBeats: 0,
  sound: 1,
  countInBars: 1,
};

const RESAVED: LinkedPresetValues = {
  ...CLICK,
  beatsPerBar: 3,
  accents: new Uint8Array([0, 2, 1]),
  perAccentSounds: new Uint8Array([3, 4]),
  sound: 3,
  countInBars: 2,
};

describe("a library song's linked preset", () => {
  it('is absent until saved', async () => {
    const { library, presets } = setup();
    const id = await library.insertSong(song('Everlong'));
    expect(await presets.forLibrarySong(id)).toBeUndefined();
  });

  it('saves one preset linked to the song', async () => {
    const { library, presets } = setup();
    const id = await library.insertSong(song('Everlong'));
    const saved = await presets.saveForLibrarySong(id, CLICK);
    expect(saved).toMatchObject({ ...CLICK, librarySongId: id });
    expect(await presets.forLibrarySong(id)).toEqual(saved);
    expect(await presets.list()).toHaveLength(1);
  });

  it('updates the same preset on a second save', async () => {
    const { library, presets } = setup();
    const id = await library.insertSong(song('Everlong'));
    const first = await presets.saveForLibrarySong(id, CLICK);
    const second = await presets.saveForLibrarySong(id, RESAVED);
    expect(second.id).toBe(first.id);
    expect(second.uuid).toBe(first.uuid);
    expect(await presets.list()).toEqual([second]);
    expect(await presets.forLibrarySong(id)).toMatchObject(RESAVED);
  });

  it("keeps each song's preset to itself", async () => {
    const { library, presets } = setup();
    const one = await library.insertSong(song('One'));
    const two = await library.insertSong(song('Two'));
    await presets.saveForLibrarySong(one, CLICK);
    await presets.saveForLibrarySong(two, RESAVED);
    expect(await presets.forLibrarySong(one)).toMatchObject(CLICK);
    expect(await presets.forLibrarySong(two)).toMatchObject(RESAVED);
  });

  it('refuses an invalid preset and writes nothing', async () => {
    const { library, presets } = setup();
    const id = await library.insertSong(song('Everlong'));
    await expect(
      presets.saveForLibrarySong(id, { ...CLICK, beatsPerBar: 5 }),
    ).rejects.toThrow(RangeError);
    expect(await presets.list()).toEqual([]);
  });

  it('unlinks, and keeps, the preset when its song is deleted without FKs', async () => {
    const { library, presets } = setup({ foreignKeys: false });
    const id = await library.insertSong(song('Everlong'));
    const saved = await presets.saveForLibrarySong(id, CLICK);
    await library.deleteSong(id);
    expect(await presets.forLibrarySong(id)).toBeUndefined();
    expect(await presets.get(saved.id)).toMatchObject({ librarySongId: null });
  });
});
