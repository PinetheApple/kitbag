import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CATEGORIES } from './backup-format';
import { openBackupDatabase, records, seed } from './backup.test-helper';
import { songPresets } from './schema';

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
    const plan = await target.backup.plan(await source.backup.export(), {
      categories: CATEGORIES,
    });
    if (!plan.ok) throw new Error(plan.error.kind);
    expect((await target.backup.apply(plan.value)).ok).toBe(true);
    expect(await records(target)).toEqual(await records(source));
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
