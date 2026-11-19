import {
  openBackupDatabase,
  unwrap,
} from '@kitbag/core-db/src/backup.test-helper';
import { encodeBase64 } from '@kitbag/core-db/src/base64';
import { customSoundId, KB_DEFAULT_SOUNDS } from '@kitbag/core-native';
import { expect, it } from 'vitest';

import { stubMetronomeRuntime } from '../metronome/runtime.test-helper.ts';
import type { MetronomeSettingsInput } from '../metronome/standalone.ts';
import { configureStandaloneMetronomePersistence } from '../metronome/standalonePersistence.ts';
import { metronomeStore } from '../metronome/store.ts';
import { releaseStaleSounds } from './released.ts';

const STORED_BPM = 110;
const BUILT_IN = 2;
const SLOT = 0;
const SLOT_SOUND = customSoundId(SLOT);
const WAV = encodeBase64(new Uint8Array([0x52, 0x49, 0x46, 0x46]));

stubMetronomeRuntime(STORED_BPM);

let stored: Partial<MetronomeSettingsInput> = {
  bpm: STORED_BPM,
  sounds: { normal: SLOT_SOUND, accent: BUILT_IN },
};
configureStandaloneMetronomePersistence({
  load: () => stored,
  save: (settings) => {
    stored = settings;
  },
});

async function addSound(
  database: ReturnType<typeof openBackupDatabase>,
  name: string,
) {
  const fileName = `${name}.wav`;
  await database.clickSoundFiles.files.write(fileName, WAV);
  await database.clickSounds.put({
    slot: SLOT,
    uuid: crypto.randomUUID(),
    name,
    fileName,
  });
}

it('puts Tick in the standalone sounds when Merge takes their sound into its slot', async () => {
  const source = openBackupDatabase();
  await addSound(source, 'rimshot');
  const target = openBackupDatabase();
  await addSound(target, 'hat');
  const resolutions = {
    clickSounds: { [String(SLOT)]: 'theirs' as const },
  };
  const plan = unwrap(
    await target.backup.plan(await source.backup.export(), { resolutions }),
  );

  releaseStaleSounds(unwrap(await target.backup.apply(plan)));

  expect(stored.sounds).toEqual({
    normal: KB_DEFAULT_SOUNDS.normal,
    accent: BUILT_IN,
  });
  expect(metronomeStore.getState().sounds.normal).toBe(
    KB_DEFAULT_SOUNDS.normal,
  );
});

it('keeps the standalone sounds when Merge keeps mine in their slot', async () => {
  stored = {
    bpm: STORED_BPM,
    sounds: { normal: SLOT_SOUND, accent: BUILT_IN },
  };
  const source = openBackupDatabase();
  await addSound(source, 'rimshot');
  const target = openBackupDatabase();
  await addSound(target, 'hat');
  const resolutions = { clickSounds: { [String(SLOT)]: 'mine' as const } };
  const plan = unwrap(
    await target.backup.plan(await source.backup.export(), { resolutions }),
  );

  releaseStaleSounds(unwrap(await target.backup.apply(plan)));

  expect(stored.sounds).toEqual({ normal: SLOT_SOUND, accent: BUILT_IN });
});
