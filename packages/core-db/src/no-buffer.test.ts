import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CATEGORIES } from './backup-format';
import {
  openBackupDatabase,
  records,
  seed,
  unwrap,
} from './backup.test-helper';
import { decodeBase64, encodeBase64 } from './base64';
import { freshClickSoundFileName } from './click-sound-files';
import { songPresets } from './schema';

const FLOAT_WAV = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x80, 0x3f, 0x00, 0x00, 0x80, 0xbf, 0xff,
]);

const nodeBuffer = globalThis.Buffer;

beforeEach(() => {
  Reflect.deleteProperty(globalThis, 'Buffer');
});

afterEach(() => {
  globalThis.Buffer = nodeBuffer;
});

describe('without a Buffer global, as on Hermes', () => {
  it('reads presets and setlists through the repositories', async () => {
    const database = openBackupDatabase();
    const { opener, friday } = await seed(database);
    expect(await database.presets.get(opener.id)).toEqual(opener);
    expect(await database.sets.items(friday.id)).toHaveLength(2);
  });

  it('round-trips a full backup', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const target = openBackupDatabase();
    const plan = unwrap(
      await target.backup.plan(await source.backup.export(), {
        categories: CATEGORIES,
      }),
    );
    expect((await target.backup.apply(plan)).ok).toBe(true);
    expect(await records(target)).toEqual(await records(source));
  });

  it('round-trips a click sound WAV through a backup', async () => {
    const source = openBackupDatabase();
    const fileName = freshClickSoundFileName();
    await source.clickSoundFiles.files.write(fileName, encodeBase64(FLOAT_WAV));
    await source.clickSounds.put({
      slot: 0,
      uuid: crypto.randomUUID(),
      name: 'Rimshot',
      fileName,
    });
    const target = openBackupDatabase();
    unwrap(
      await target.backup.apply(
        unwrap(await target.backup.plan(await source.backup.export())),
      ),
    );
    const [restored] = await target.clickSounds.list();
    const wav = await target.clickSoundFiles.files.read(
      restored?.fileName ?? '',
    );
    expect(decodeBase64(wav)).toEqual(FLOAT_WAV);
  });

  it('reads the ArrayBuffer op-sqlite returns as a fresh Uint8Array', () => {
    const driverValue = new Uint8Array([2, 1, 0, 1]).buffer;
    const read = songPresets.accents.mapFromDriverValue(
      driverValue,
    ) as Uint8Array;
    expect(read).toEqual(new Uint8Array([2, 1, 0, 1]));
    expect(read.buffer).not.toBe(driverValue);
  });
});
