import { describe, expect, it, vi } from 'vitest';

import {
  openBackupDatabase,
  presetValues,
  unwrap,
  type BackupDatabase,
} from './backup.test-helper';
import { decodeBase64, encodeBase64 } from './base64';
import { freshClickSoundFileName } from './click-sound-files';
import type { ClickSound } from './click-sound-repository';
import { CUSTOM_SOUND_SLOTS, SOUND_COUNT, TICK_SOUND } from './preset-rules';

type SoundIdentity = Omit<ClickSound, 'fileName'>;

const RIMSHOT: SoundIdentity = {
  slot: 0,
  uuid: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
  name: 'Rimshot',
};

const HAT: SoundIdentity = {
  slot: 0,
  uuid: '7a2b3c4d-5e6f-4a70-8b81-a2c3d4e5f607',
  name: 'Hat',
};

const SLOT_ZERO_ID = SOUND_COUNT;

const RIFF_HEADER = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00];
const RIMSHOT_WAV = new Uint8Array([...RIFF_HEADER, 0x00, 0x80, 0xff, 0x3f]);
const HAT_WAV = new Uint8Array([...RIFF_HEADER, 0x7f, 0x01, 0xfe, 0xbf]);

async function addSound(
  database: BackupDatabase,
  sound: SoundIdentity,
  wav: Uint8Array,
) {
  const fileName = freshClickSoundFileName();
  await database.clickSoundFiles.files.write(fileName, encodeBase64(wav));
  await database.clickSounds.put({ ...sound, fileName });
  return fileName;
}

async function storedWav(database: BackupDatabase, slot: number) {
  const sound = await database.clickSounds.get(slot);
  if (sound === null) return null;
  return decodeBase64(
    await database.clickSoundFiles.files.read(sound.fileName),
  );
}

async function addCustomSong(database: BackupDatabase, name: string) {
  return database.presets.create({
    ...presetValues(name, null),
    sound: SLOT_ZERO_ID,
    perAccentSounds: new Uint8Array([SLOT_ZERO_ID, SLOT_ZERO_ID]),
  });
}

async function rimshotBackup() {
  const source = openBackupDatabase();
  await addSound(source, RIMSHOT, RIMSHOT_WAV);
  return { source, file: await source.backup.export() };
}

function withoutClickSounds(file: string): string {
  const root = JSON.parse(file) as Record<string, unknown>;
  delete root.clickSounds;
  root.categories = (root.categories as string[]).filter(
    (category) => category !== 'clickSounds',
  );
  return JSON.stringify(root);
}

function withClickSounds(file: string, clickSounds: unknown[]): string {
  return JSON.stringify({
    ...(JSON.parse(file) as Record<string, unknown>),
    clickSounds,
  });
}

describe('click sounds in a backup', () => {
  it('carries each sound by slot with its prepared WAV as base64', async () => {
    const { file } = await rimshotBackup();
    const root = JSON.parse(file) as Record<string, unknown>;
    expect(root.categories).toContain('clickSounds');
    expect(root.clickSounds).toEqual([
      { ...RIMSHOT, wav: encodeBase64(RIMSHOT_WAV) },
    ]);
  });

  it('restores a sound under a new file name with the same identity and audio', async () => {
    const { source, file } = await rimshotBackup();
    const target = openBackupDatabase();
    const plan = unwrap(await target.backup.plan(file));
    expect(plan.categories).toContain('clickSounds');
    unwrap(await target.backup.apply(plan));
    const restored = await target.clickSounds.get(RIMSHOT.slot);
    expect(restored).toMatchObject(RIMSHOT);
    expect(restored?.fileName).not.toBe(
      (await source.clickSounds.get(RIMSHOT.slot))?.fileName,
    );
    expect(await storedWav(target, RIMSHOT.slot)).toEqual(RIMSHOT_WAV);
    expect(target.clickSoundFiles.stored.size).toBe(1);
  });

  it('reads the same sound in the same slot as unchanged, whatever its name', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    await addSound(target, { ...RIMSHOT, name: 'Rim click' }, RIMSHOT_WAV);
    const plan = unwrap(await target.backup.plan(file));
    expect(plan.counts.clickSounds).toMatchObject({
      incoming: 1,
      new: 0,
      unchanged: 1,
      conflicts: [],
    });
  });

  it('reviews a different sound in the same slot as a conflict', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    await addSound(target, HAT, HAT_WAV);
    const plan = unwrap(await target.backup.plan(file));
    expect(plan.unresolved).toEqual([
      { category: 'clickSounds', key: String(RIMSHOT.slot), label: 'Rimshot' },
    ]);
    expect((await target.backup.apply(plan)).ok).toBe(false);
    expect(await target.clickSounds.get(HAT.slot)).toMatchObject(HAT);
  });

  it('keeps mine on a conflict resolved that way', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    const hatFile = await addSound(target, HAT, HAT_WAV);
    const resolutions = {
      clickSounds: { [String(HAT.slot)]: 'mine' as const },
    };
    unwrap(
      await target.backup.apply(
        unwrap(await target.backup.plan(file, { resolutions })),
      ),
    );
    expect(await target.clickSounds.get(HAT.slot)).toEqual({
      ...HAT,
      fileName: hatFile,
    });
    expect([...target.clickSoundFiles.stored.keys()]).toEqual([hatFile]);
  });

  it('takes theirs into the slot and deletes the file it replaced', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    const hatFile = await addSound(target, HAT, HAT_WAV);
    const resolutions = {
      clickSounds: { [String(HAT.slot)]: 'theirs' as const },
    };
    unwrap(
      await target.backup.apply(
        unwrap(await target.backup.plan(file, { resolutions })),
      ),
    );
    expect(await target.clickSounds.get(RIMSHOT.slot)).toMatchObject(RIMSHOT);
    expect(await storedWav(target, RIMSHOT.slot)).toEqual(RIMSHOT_WAV);
    expect(target.clickSoundFiles.stored.has(hatFile)).toBe(false);
    expect(target.clickSoundFiles.stored.size).toBe(1);
  });

  it('leaves local sounds alone when the backup predates click sounds', async () => {
    const { file } = await rimshotBackup();
    const older = withoutClickSounds(file);
    const target = openBackupDatabase();
    const hatFile = await addSound(target, HAT, HAT_WAV);
    for (const mode of ['merge', 'replace'] as const) {
      const plan = unwrap(await target.backup.plan(older, { mode }));
      expect(plan.categories).not.toContain('clickSounds');
      unwrap(await target.backup.apply(plan, { confirmReplace: true }));
    }
    expect(await target.clickSounds.list()).toEqual([
      { ...HAT, fileName: hatFile },
    ]);
    expect(target.clickSoundFiles.stored.has(hatFile)).toBe(true);
  });

  it('replaces every local sound with the backup’s and deletes the old files', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    const otherSlot = { ...HAT, slot: CUSTOM_SOUND_SLOTS - 1 };
    const hatFile = await addSound(target, otherSlot, HAT_WAV);
    const plan = unwrap(
      await target.backup.plan(file, {
        mode: 'replace',
        categories: ['clickSounds'],
      }),
    );
    expect(plan.counts.clickSounds).toMatchObject({ new: 1, deletes: 1 });
    unwrap(await target.backup.apply(plan, { confirmReplace: true }));
    expect(await target.clickSounds.list()).toEqual([
      expect.objectContaining(RIMSHOT),
    ]);
    expect(target.clickSoundFiles.stored.has(hatFile)).toBe(false);
  });

  it('leaves the database and files as they were when a file write fails', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    vi.spyOn(target.clickSoundFiles.files, 'write').mockRejectedValue(
      new Error('ENOSPC'),
    );
    const result = await target.backup.apply(
      unwrap(await target.backup.plan(file)),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'databaseError' },
    });
    expect(await target.clickSounds.list()).toEqual([]);
    expect(target.clickSoundFiles.stored.size).toBe(0);
  });

  it('removes a file it wrote when the restore fails after writing it', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    const plan = unwrap(await target.backup.plan(file));
    const failing = vi
      .spyOn(target.handle.db, 'insert')
      .mockImplementationOnce(() => {
        throw new Error('disk I/O error');
      });
    const result = await target.backup.apply(plan);
    failing.mockRestore();
    expect(result.ok).toBe(false);
    expect(await target.clickSounds.list()).toEqual([]);
    expect(target.clickSoundFiles.stored.size).toBe(0);
  });
});

describe('song sounds after a restore', () => {
  it('keeps a custom sound on a song restored with that sound', async () => {
    const { source } = await rimshotBackup();
    await addCustomSong(source, 'Uses rimshot');
    const target = openBackupDatabase();
    const report = unwrap(
      await target.backup.apply(
        unwrap(await target.backup.plan(await source.backup.export())),
      ),
    );
    expect(report.soundResets).toBe(0);
    const [song] = await target.presets.list();
    expect(song).toMatchObject({ sound: SLOT_ZERO_ID });
  });

  it('puts Tick on a restored song whose sound did not come with it', async () => {
    const { source } = await rimshotBackup();
    await addCustomSong(source, 'Uses rimshot');
    const target = openBackupDatabase();
    const plan = unwrap(
      await target.backup.plan(await source.backup.export(), {
        categories: ['songPresets', 'setlists'],
      }),
    );
    const report = unwrap(await target.backup.apply(plan));
    expect(report.soundResets).toBe(1);
    const [song] = await target.presets.list();
    expect(song).toMatchObject({
      sound: TICK_SOUND,
      perAccentSounds: new Uint8Array([TICK_SOUND, TICK_SOUND]),
    });
  });

  it('puts Tick on a song on this device when a restore puts another sound in its slot', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    await addSound(target, HAT, HAT_WAV);
    const local = await addCustomSong(target, 'Uses hat');
    const resolutions = {
      clickSounds: { [String(HAT.slot)]: 'theirs' as const },
    };
    const report = unwrap(
      await target.backup.apply(
        unwrap(await target.backup.plan(file, { resolutions })),
      ),
    );
    expect(report.soundResets).toBe(1);
    expect(await target.presets.get(local.id)).toMatchObject({
      sound: TICK_SOUND,
    });
  });

  it('keeps a song on this device whose sound the restore left in place', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    await addSound(target, HAT, HAT_WAV);
    const local = await addCustomSong(target, 'Uses hat');
    const resolutions = {
      clickSounds: { [String(HAT.slot)]: 'mine' as const },
    };
    const report = unwrap(
      await target.backup.apply(
        unwrap(await target.backup.plan(file, { resolutions })),
      ),
    );
    expect(report.soundResets).toBe(0);
    expect(await target.presets.get(local.id)).toMatchObject({
      sound: SLOT_ZERO_ID,
    });
  });
});

describe('click sound records in a backup file', () => {
  it('refuses a slot the engine does not have', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    const bad = withClickSounds(file, [
      { ...RIMSHOT, slot: CUSTOM_SOUND_SLOTS, wav: encodeBase64(RIMSHOT_WAV) },
    ]);
    expect(await target.backup.plan(bad)).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: '$.clickSounds[0].slot' },
    });
  });

  it('refuses audio that is not base64', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    const bad = withClickSounds(file, [{ ...RIMSHOT, wav: 'not base64!' }]);
    expect(await target.backup.plan(bad)).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: '$.clickSounds[0].wav' },
    });
  });

  it('refuses two sounds in one slot', async () => {
    const { file } = await rimshotBackup();
    const target = openBackupDatabase();
    const wav = encodeBase64(RIMSHOT_WAV);
    const bad = withClickSounds(file, [
      { ...RIMSHOT, wav },
      { ...HAT, wav },
    ]);
    expect(await target.backup.plan(bad)).toMatchObject({
      ok: false,
      error: { kind: 'duplicateIdentity', category: 'clickSounds' },
    });
  });
});
