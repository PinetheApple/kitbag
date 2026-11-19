import { afterEach, describe, expect, it } from 'vitest';

import {
  CUSTOM_SOUND_SLOTS,
  SOUND_COUNT,
  SOUND_ID_COUNT,
} from './preset-rules';
import type { NewSongPreset } from './repository';
import { createSongPresetRepository } from './song-preset-repository';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function presets() {
  const handle = openTestDatabase();
  open.push(handle);
  return createSongPresetRepository(handle);
}

const FIRST_CUSTOM = SOUND_COUNT;
const LAST_CUSTOM = SOUND_COUNT + CUSTOM_SOUND_SLOTS - 1;

const preset = (sound: number, accent: number): NewSongPreset => ({
  name: 'Custom',
  bpm: 120,
  beatsPerBar: 4,
  subdivision: 1,
  accents: new Uint8Array([2, 1, 1, 1]),
  perAccentSounds: new Uint8Array([sound, accent]),
  polyEnabled: false,
  polyBeats: 0,
  sound,
});

describe('preset sound ids', () => {
  it('counts the built-in sounds and the custom slots', () => {
    expect(SOUND_ID_COUNT).toBe(SOUND_COUNT + CUSTOM_SOUND_SLOTS);
  });

  it('saves a preset on either custom slot', async () => {
    const repository = presets();
    const saved = await repository.create(preset(FIRST_CUSTOM, LAST_CUSTOM));
    expect(await repository.get(saved.id)).toMatchObject({
      sound: FIRST_CUSTOM,
      perAccentSounds: new Uint8Array([FIRST_CUSTOM, LAST_CUSTOM]),
    });
  });

  it('refuses a sound id past the last custom slot', async () => {
    const repository = presets();
    await expect(repository.create(preset(SOUND_ID_COUNT, 0))).rejects.toThrow(
      /sound/,
    );
    await expect(repository.create(preset(0, SOUND_ID_COUNT))).rejects.toThrow(
      /perAccentSounds/,
    );
  });
});
