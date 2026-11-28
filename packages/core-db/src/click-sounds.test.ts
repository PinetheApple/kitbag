import { afterEach, describe, expect, it } from 'vitest';

import {
  createClickSoundRepository,
  type ClickSound,
} from './click-sound-repository';
import { CUSTOM_SOUND_SLOTS, SOUND_COUNT, TICK_SOUND } from './preset-rules';
import type { NewSongPreset } from './repository';
import { createSongPresetRepository } from './song-preset-repository';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return {
    sounds: createClickSoundRepository(handle),
    presets: createSongPresetRepository(handle),
  };
}

const RIMSHOT: ClickSound = {
  slot: 0,
  uuid: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
  name: 'Rimshot',
  fileName: '0a1b2c3d-0000-4000-8000-000000000001.wav',
};

const HAT: ClickSound = {
  slot: 1,
  uuid: '7a2b3c4d-5e6f-4a70-8b81-a2c3d4e5f607',
  name: 'Hat',
  fileName: '0a1b2c3d-0000-4000-8000-000000000002.wav',
};

const RIMSHOT_ID = SOUND_COUNT + RIMSHOT.slot;
const HAT_ID = SOUND_COUNT + HAT.slot;
const BUILT_IN = 2;

const preset = (
  name: string,
  normal: number,
  accent: number,
): NewSongPreset => ({
  name,
  bpm: 120,
  beatsPerBar: 4,
  subdivision: 1,
  accents: new Uint8Array([2, 1, 1, 1]),
  perAccentSounds: new Uint8Array([normal, accent]),
  polyEnabled: false,
  polyBeats: 0,
  sound: normal,
});

describe('click sound repository', () => {
  it('lists stored sounds by slot', async () => {
    const { sounds } = setup();
    await sounds.put(HAT);
    await sounds.put(RIMSHOT);
    expect(await sounds.list()).toEqual([RIMSHOT, HAT]);
    expect(await sounds.get(HAT.slot)).toEqual(HAT);
  });

  it('reads an empty slot as null', async () => {
    const { sounds } = setup();
    expect(await sounds.get(RIMSHOT.slot)).toBeNull();
  });

  it('replaces a slot in place and hands back the sound it held', async () => {
    const { sounds } = setup();
    expect(await sounds.put(RIMSHOT)).toBeNull();
    const replacement = { ...HAT, slot: RIMSHOT.slot };
    expect(await sounds.put(replacement)).toEqual(RIMSHOT);
    expect(await sounds.list()).toEqual([replacement]);
  });

  it('refuses a slot the engine does not have', async () => {
    const { sounds } = setup();
    await expect(
      sounds.put({ ...RIMSHOT, slot: CUSTOM_SOUND_SLOTS }),
    ).rejects.toThrow(RangeError);
    await expect(sounds.put({ ...RIMSHOT, slot: -1 })).rejects.toThrow(
      RangeError,
    );
  });

  it('refuses a blank name', async () => {
    const { sounds } = setup();
    await expect(sounds.put({ ...RIMSHOT, name: '  ' })).rejects.toThrow(
      RangeError,
    );
  });

  it('renames a sound and keeps its identity and file', async () => {
    const { sounds } = setup();
    await sounds.put(RIMSHOT);
    await sounds.rename(RIMSHOT.slot, 'Rim click');
    expect(await sounds.get(RIMSHOT.slot)).toEqual({
      ...RIMSHOT,
      name: 'Rim click',
    });
    await expect(sounds.rename(RIMSHOT.slot, '')).rejects.toThrow(RangeError);
  });

  it('refuses to rename a slot the engine does not have', async () => {
    const { sounds } = setup();
    await expect(sounds.rename(CUSTOM_SOUND_SLOTS, 'Rim')).rejects.toThrow(
      RangeError,
    );
  });

  it('adds a sound only to an empty slot', async () => {
    const { sounds } = setup();
    expect(await sounds.add(RIMSHOT)).toBe(true);
    expect(await sounds.add({ ...HAT, slot: RIMSHOT.slot })).toBe(false);
    expect(await sounds.list()).toEqual([RIMSHOT]);
  });

  it('removes a sound, puts Tick back on every song that used it and counts them', async () => {
    const { sounds, presets } = setup();
    await sounds.put(RIMSHOT);
    await sounds.put(HAT);
    const normal = await presets.create(preset('Normal', RIMSHOT_ID, BUILT_IN));
    const accent = await presets.create(preset('Accent', BUILT_IN, RIMSHOT_ID));
    const other = await presets.create(preset('Other', HAT_ID, BUILT_IN));
    const result = await sounds.remove(RIMSHOT.slot);
    expect(result).toMatchObject({ removed: RIMSHOT, songsReset: 2 });
    expect(await presets.get(normal.id)).toMatchObject({
      sound: TICK_SOUND,
      perAccentSounds: new Uint8Array([TICK_SOUND, BUILT_IN]),
    });
    expect(await presets.get(accent.id)).toMatchObject({
      sound: BUILT_IN,
      perAccentSounds: new Uint8Array([BUILT_IN, TICK_SOUND]),
    });
    expect(await presets.get(other.id)).toMatchObject({ sound: HAT_ID });
    expect(await sounds.list()).toEqual([HAT]);
  });

  it('resets a song that names the sound only in its legacy sound column', async () => {
    const { sounds, presets } = setup();
    await sounds.put(RIMSHOT);
    const legacy = await presets.create({
      ...preset('Legacy', RIMSHOT_ID, RIMSHOT_ID),
      perAccentSounds: null,
    });
    expect((await sounds.remove(RIMSHOT.slot)).songsReset).toBe(1);
    expect(await presets.get(legacy.id)).toMatchObject({
      sound: TICK_SOUND,
      perAccentSounds: null,
    });
  });

  it('removes an empty slot as a no-op', async () => {
    const { sounds } = setup();
    expect(await sounds.remove(HAT.slot)).toEqual({
      removed: null,
      songsReset: 0,
      resets: [],
    });
  });
});

describe('undoing a click sound remove', () => {
  it('puts the sound back in its slot and on every beat of every song that used it', async () => {
    const { sounds, presets } = setup();
    await sounds.put(RIMSHOT);
    const normal = await presets.create(preset('Normal', RIMSHOT_ID, BUILT_IN));
    const both = await presets.create(preset('Both', RIMSHOT_ID, RIMSHOT_ID));
    const { resets } = await sounds.remove(RIMSHOT.slot);
    expect(await sounds.restore({ sound: RIMSHOT, resets })).toBe(true);
    expect(await sounds.list()).toEqual([RIMSHOT]);
    expect(await presets.get(normal.id)).toEqual(normal);
    expect(await presets.get(both.id)).toEqual(both);
  });

  it('keeps a beat changed to another sound in the meantime', async () => {
    const { sounds, presets } = setup();
    await sounds.put(RIMSHOT);
    const song = await presets.create(preset('Song', RIMSHOT_ID, RIMSHOT_ID));
    const { resets } = await sounds.remove(RIMSHOT.slot);
    await presets.update(song.id, {
      perAccentSounds: new Uint8Array([TICK_SOUND, BUILT_IN]),
    });
    await sounds.restore({ sound: RIMSHOT, resets });
    expect(await presets.get(song.id)).toMatchObject({
      sound: RIMSHOT_ID,
      perAccentSounds: new Uint8Array([RIMSHOT_ID, BUILT_IN]),
    });
  });

  it('refuses when another sound took the slot', async () => {
    const { sounds } = setup();
    await sounds.put(RIMSHOT);
    const { resets } = await sounds.remove(RIMSHOT.slot);
    await sounds.put({ ...HAT, slot: RIMSHOT.slot });
    expect(await sounds.restore({ sound: RIMSHOT, resets })).toBe(false);
    expect(await sounds.get(RIMSHOT.slot)).toMatchObject({ name: HAT.name });
  });
});
