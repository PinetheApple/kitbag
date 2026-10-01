import { afterEach, beforeEach, expect, it } from 'vitest';

import { createSetlistRepository } from './setlist-repository';
import { createSongPresetRepository } from './song-preset-repository';
import { openTestDatabase } from './sqlite.test-helper';

let handle: ReturnType<typeof openTestDatabase>;
let sets: ReturnType<typeof createSetlistRepository>;
let presets: ReturnType<typeof createSongPresetRepository>;

beforeEach(() => {
  handle = openTestDatabase();
  sets = createSetlistRepository(handle);
  presets = createSongPresetRepository(handle);
});

afterEach(() => {
  handle.connection.close();
});

const preset = (name: string) =>
  presets.create({
    name,
    bpm: 120,
    beatsPerBar: 4,
    subdivision: 1,
    accents: new Uint8Array([2, 1, 1, 1]),
    polyEnabled: false,
    polyBeats: 0,
    sound: 0,
  });

const order = async (setlistId: number) =>
  (await sets.items(setlistId)).map((item) => item.songPresetId);

it('smoke: create→edit→reorder→move→remove→duplicate→delete', async () => {
  const friday = await sets.create('Friday');
  const acoustic = await sets.create('Acoustic');
  const [a, b, c] = [await preset('A'), await preset('B'), await preset('C')];
  const [itemA, , itemC] = [
    await sets.add(friday.id, a.id),
    await sets.add(friday.id, b.id),
    await sets.add(friday.id, c.id),
  ];
  expect(await order(friday.id)).toEqual([a.id, b.id, c.id]);
  await presets.update(b.id, { notes: 'Edited', bpm: 96 });
  expect(await presets.get(b.id)).toMatchObject({ notes: 'Edited', bpm: 96 });
  await sets.move(itemC.id, 0);
  expect(await order(friday.id)).toEqual([c.id, a.id, b.id]);
  await sets.moveTo(itemA.id, acoustic.id);
  expect(await order(friday.id)).toEqual([c.id, b.id]);
  expect(await order(acoustic.id)).toEqual([a.id]);
  await sets.removeItem(itemA.id);
  expect(await order(acoustic.id)).toEqual([]);
  expect(await presets.get(a.id)).toEqual(a);
  const copy = await presets.duplicate(b.id, 'B (2)');
  expect(copy).toMatchObject({ name: 'B (2)', notes: 'Edited', bpm: 96 });
  expect(copy.uuid).not.toBe(b.uuid);
  await presets.delete(b.id);
  expect(await presets.get(b.id)).toBeUndefined();
  expect(await order(friday.id)).toEqual([c.id]);
  expect(await presets.get(copy.id)).toMatchObject({ name: 'B (2)' });
});
