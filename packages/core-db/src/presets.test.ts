import { afterEach, describe, expect, it } from 'vitest';

import { POLY_AGAINST_BAR } from './preset-rules';
import type { NewSongPreset } from './repository';
import { createSetlistRepository } from './setlist-repository';
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
    sets: createSetlistRepository(handle),
    presets: createSongPresetRepository(handle),
  };
}

const EVERY_FIELD = {
  name: 'Opener',
  bpm: 128.5,
  beatsPerBar: 7,
  subdivision: 3,
  denominator: 8,
  accents: new Uint8Array([2, 1, 0, 1, 1, 2, 1]),
  perAccentSounds: new Uint8Array([1, 5]),
  polyAccents: new Uint8Array([2, 1, 1, 0, 1]),
  polyEnabled: true,
  polyBeats: 5,
  polyAgainst: 3,
  sound: 2,
  rampEnabled: true,
  rampStartBpm: 100,
  rampEndBpm: 140,
  rampLength: 90,
  rampStep: 5,
  rampUnit: 1,
  rampLoop: true,
  barMuteEnabled: true,
  barMutePlayBars: 3,
  barMuteMuteBars: 1,
  countInBars: 2,
  notes: 'Fingerstyle — count 3',
  phaseNudge: -12.5,
  title: 'Song',
  artist: 'Artist',
  source: 'file',
  lengthSeconds: 210.25,
  librarySongId: null,
} satisfies Required<Omit<NewSongPreset, 'id'>>;

const EDITED = {
  ...EVERY_FIELD,
  name: 'Closer',
  bpm: 90,
  beatsPerBar: 3,
  subdivision: 2,
  denominator: 4,
  accents: new Uint8Array([2, 0, 1]),
  perAccentSounds: null,
  polyAccents: new Uint8Array([1, 2]),
  polyEnabled: false,
  polyBeats: 2,
  polyAgainst: 0,
  sound: 0,
  rampEnabled: false,
  rampStartBpm: null,
  rampEndBpm: null,
  rampLength: null,
  rampStep: 1,
  rampUnit: 0,
  rampLoop: false,
  barMuteEnabled: false,
  barMutePlayBars: null,
  barMuteMuteBars: null,
  countInBars: 0,
  notes: null,
  phaseNudge: 7.25,
  title: null,
  artist: null,
  source: null,
  lengthSeconds: null,
} satisfies Required<Omit<NewSongPreset, 'id'>>;

describe('song preset repository', () => {
  it('round-trips every field on create', async () => {
    const { presets } = setup();
    const created = await presets.create(EVERY_FIELD);
    expect(await presets.get(created.id)).toEqual({
      ...EVERY_FIELD,
      id: created.id,
      uuid: created.uuid,
    });
  });

  it('round-trips every field on update', async () => {
    const { presets } = setup();
    const created = await presets.create(EVERY_FIELD);
    await presets.update(created.id, EDITED);
    expect(await presets.get(created.id)).toEqual({
      ...EDITED,
      id: created.id,
      uuid: created.uuid,
    });
  });

  it('duplicates every field under a new identity and name', async () => {
    const { presets } = setup();
    const source = await presets.create(EVERY_FIELD);
    const copy = await presets.duplicate(source.id, 'Opener (2)');
    expect(copy.id).not.toBe(source.id);
    expect(copy.uuid).not.toBe(source.uuid);
    expect(copy).toEqual({
      ...source,
      id: copy.id,
      uuid: copy.uuid,
      name: 'Opener (2)',
    });
  });

  it('deletes its memberships explicitly, without relying on FK cascades', async () => {
    const { sets, presets } = setup({ foreignKeys: false });
    const preset = await presets.create(EVERY_FIELD);
    const kept = await presets.create({ ...EVERY_FIELD, name: 'Kept' });
    const friday = await sets.create('Friday');
    const acoustic = await sets.create('Acoustic');
    await sets.add(friday.id, preset.id);
    await sets.add(friday.id, kept.id);
    await sets.add(acoustic.id, preset.id);
    await presets.delete(preset.id);
    expect(await presets.get(preset.id)).toBeUndefined();
    expect(
      (await sets.items(friday.id)).map((item) => item.songPresetId),
    ).toEqual([kept.id]);
    expect(await sets.items(acoustic.id)).toEqual([]);
  });

  it('searches name, title and artist literally', async () => {
    const { presets } = setup();
    await presets.create({ ...EVERY_FIELD, name: '100% Pure' });
    await presets.create({ ...EVERY_FIELD, name: '1000 Miles', title: 'a_b' });
    await presets.create({ ...EVERY_FIELD, name: 'Other', artist: 'axb' });
    const names = async (query: string) =>
      (await presets.search(query)).map((preset) => preset.name);
    expect(await names('100%')).toEqual(['100% Pure']);
    expect(await names('a_b')).toEqual(['1000 Miles']);
    expect(await names('AXB')).toEqual(['Other']);
    expect(await names('missing')).toEqual([]);
  });
  it.each([
    ['bpm', { bpm: 19 }],
    ['beatsPerBar', { beatsPerBar: 17, accents: new Uint8Array(17).fill(1) }],
    ['denominator', { denominator: 3 }],
    ['sound', { sound: 6 }],
    ['subdivision', { subdivision: 17 }],
    ['rampEndBpm', { rampEndBpm: 401 }],
    ['rampLength', { rampLength: 65, rampUnit: 0 }],
    ['rampLength', { rampLength: 8.5, rampUnit: 0 }],
    ['rampLength', { rampLength: 3601, rampUnit: 1 }],
    ['rampLength', { rampLength: 61, rampUnit: 2 }],
    ['rampUnit', { rampUnit: 3 }],
    ['barMutePlayBars', { barMutePlayBars: 1.5 }],
    ['barMuteMuteBars', { barMuteMuteBars: 0 }],
    ['accents', { accents: new Uint8Array([1, 1, 1]) }],
    ['accents', { accents: new Uint8Array([2, 1, 3, 1, 1, 1, 1]) }],
    ['perAccentSounds', { perAccentSounds: new Uint8Array([1, 2, 3]) }],
    ['perAccentSounds', { perAccentSounds: new Uint8Array([1, 6]) }],
    ['polyAccents', { polyAccents: new Uint8Array([1, 1]) }],
    ['polyAgainst', { polyAgainst: 17 }],
    ['polyAgainst', { polyAgainst: -1 }],
    ['polyAgainst', { polyAgainst: 2.5 }],
  ])('refuses to create a preset with an invalid %s', async (field, change) => {
    const { presets } = setup();
    await expect(presets.create({ ...EVERY_FIELD, ...change })).rejects.toThrow(
      `Song preset ${field}`,
    );
    expect(await presets.list()).toEqual([]);
  });

  it('stores a poly cycle equal to the bar as the bar on create', async () => {
    const { presets } = setup();
    const created = await presets.create({ ...EVERY_FIELD, polyAgainst: 7 });
    expect(created.polyAgainst).toBe(POLY_AGAINST_BAR);
  });

  it('stores a poly cycle equal to the bar as the bar on update', async () => {
    const { presets } = setup();
    const created = await presets.create(EVERY_FIELD);
    await presets.update(created.id, { polyAgainst: 7 });
    expect((await presets.get(created.id))?.polyAgainst).toBe(POLY_AGAINST_BAR);
  });

  it('turns a kept poly cycle into the bar when an update makes the meter equal it', async () => {
    const { presets } = setup();
    const created = await presets.create(EVERY_FIELD);
    await presets.update(created.id, {
      beatsPerBar: 3,
      accents: new Uint8Array([2, 1, 1]),
    });
    expect((await presets.get(created.id))?.polyAgainst).toBe(POLY_AGAINST_BAR);
  });

  it('refuses an update that breaks the bar and keeps the row', async () => {
    const { presets } = setup();
    const created = await presets.create(EVERY_FIELD);
    await expect(
      presets.update(created.id, { beatsPerBar: 4 }),
    ).rejects.toThrow('Song preset accents');
    expect(await presets.get(created.id)).toEqual(created);
  });
});
