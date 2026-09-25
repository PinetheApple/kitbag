import { afterEach, describe, expect, it } from 'vitest';

import {
  createSetlistRepository,
  createSongPresetRepository,
} from './repositories';
import { openTestDatabase } from './test-db';

const databases: ReturnType<typeof openTestDatabase>[] = [];

function presetValues(name: string) {
  return {
    name,
    bpm: 120,
    beatsPerBar: 4,
    subdivision: 1,
    denominator: 4,
    accents: Buffer.from([3, 1, 1, 1]),
    perAccentSounds: Buffer.from([1, 2, 3, 4]),
    polyAccents: Buffer.from([3, 1, 1, 1, 1]),
    polyEnabled: true,
    polyBeats: 5,
    sound: 2,
    rampEnabled: true,
    rampStartBpm: 100,
    rampEndBpm: 140,
    rampBars: 8,
    barMuteEnabled: true,
    barMutePlayBars: 3,
    barMuteMuteBars: 1,
    countInBars: 2,
    notes: 'Fingerstyle',
    phaseNudge: -12,
    title: 'Song',
    artist: 'Artist',
    source: 'file',
    lengthSeconds: 210,
    librarySongId: null,
  };
}

afterEach(() => {
  for (const { connection } of databases.splice(0)) connection.close();
});

describe('repositories', () => {
  it('runs the complete setlist and preset lifecycle', async () => {
    const database = openTestDatabase();
    databases.push(database);
    const sets = createSetlistRepository(database.db);
    const presets = createSongPresetRepository(database.db);
    const first = await presets.create(presetValues('First'));
    const second = await presets.create(presetValues('Second'));
    const setlist = await sets.create('Friday 100%');
    const other = await sets.create('Other');
    const firstItem = await sets.add(setlist.id, first.id);
    const secondItem = await sets.add(setlist.id, second.id);
    await sets.move(secondItem.id, 0);
    expect(
      (await sets.items(setlist.id)).map((item) => item.songPresetId),
    ).toEqual([second.id, first.id]);
    await sets.moveTo(firstItem.id, other.id);
    expect(
      (await sets.items(other.id)).map((item) => item.songPresetId),
    ).toEqual([first.id]);
    await sets.removeItem(firstItem.id);
    expect(await presets.get(first.id)).toMatchObject({ name: 'First' });
    await presets.update(second.id, { notes: 'Edited' });
    expect((await presets.get(second.id))?.notes).toBe('Edited');
    const duplicate = await presets.duplicate(second.id, 'Copy');
    expect(duplicate.uuid).not.toBe((await presets.get(second.id))?.uuid);
    await presets.delete(second.id);
    expect(await sets.items(setlist.id)).toEqual([]);
    expect(await presets.get(duplicate.id)).toMatchObject({
      name: 'Copy',
      notes: 'Edited',
    });
    expect(await sets.search('missing%')).toEqual([]);
  });

  it('selects and clears one active setlist atomically', async () => {
    const database = openTestDatabase();
    databases.push(database);
    const sets = createSetlistRepository(database.db);
    const first = await sets.create('First');
    const second = await sets.create('Second');
    await sets.selectActive(first.id);
    await sets.selectActive(second.id);
    expect((await sets.list()).filter((setlist) => setlist.active)).toEqual([
      expect.objectContaining({ id: second.id }),
    ]);
    await sets.selectActive(null);
    expect((await sets.list()).filter((setlist) => setlist.active)).toEqual([]);
  });
});
