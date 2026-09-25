import { describe, expect, it } from 'vitest';

import { CATEGORIES } from './backup-format';
import {
  openBackupDatabase,
  records,
  seed,
  SESSION_START,
  type BackupDatabase,
} from './backup.test-helper';
import type { SongPreset } from './repository';
import { practiceSessions } from './schema';

async function restoreAll(target: BackupDatabase, file: string) {
  const plan = await target.backup.plan(file, { categories: CATEGORIES });
  if (!plan.ok) throw new Error(plan.error.kind);
  return target.backup.apply(plan.value);
}

describe('backup round trip', () => {
  it('restores every category, field and relationship into an empty database', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const target = openBackupDatabase();
    expect((await restoreAll(target, await source.backup.export())).ok).toBe(
      true,
    );
    expect(await records(target)).toEqual(await records(source));
  });

  it('keeps preset fields, order, active, and practice links intact', async () => {
    const source = openBackupDatabase();
    const { opener, closer, friday } = await seed(source);
    const target = openBackupDatabase();
    await restoreAll(target, await source.backup.export());
    const restored = await target.presets.list();
    const portable = (preset: SongPreset) => ({
      ...preset,
      id: 0,
      librarySongId: preset.librarySongId === null ? null : 0,
    });
    expect(restored.map(portable)).toEqual([opener, closer].map(portable));
    const active = await target.sets.active();
    expect(active).toMatchObject({ uuid: friday.uuid, name: 'Friday' });
    const items = await target.sets.items(active?.id ?? -1);
    expect(items.map((item) => item.position)).toEqual([0, 1]);
    expect(items.map((item) => item.songPresetId)).toEqual(
      [closer, opener].map(
        (preset) => restored.find((row) => row.uuid === preset.uuid)?.id,
      ),
    );
    const [session] = await target.handle.db.select().from(practiceSessions);
    expect(session).toMatchObject({
      startTime: SESSION_START,
      setlistId: active?.id,
      songsPlayed: JSON.stringify([opener.uuid, closer.uuid]),
    });
  });

  it('links a restored preset to its restored library song', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const target = openBackupDatabase();
    await restoreAll(target, await source.backup.export());
    const [opener] = await target.presets.list();
    const [song] = (await target.handle.db.query.songs.findMany()).filter(
      (row) => row.id === opener?.librarySongId,
    );
    expect(song?.title).toBe('Reference');
  });

  it('merging the same file twice creates nothing the second time', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const file = await source.backup.export();
    const target = openBackupDatabase();
    await restoreAll(target, file);
    const before = await records(target);
    const second = await target.backup.plan(file, { categories: CATEGORIES });
    expect(second.ok && second.value.counts.songPresets).toMatchObject({
      incoming: 2,
      new: 0,
      unchanged: 2,
      conflicts: [],
    });
    expect((await restoreAll(target, file)).ok).toBe(true);
    expect(await records(target)).toEqual(before);
  });

  it('merging a file into its own source database changes nothing', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const before = await records(source);
    const result = await restoreAll(source, await source.backup.export());
    expect(result.ok).toBe(true);
    expect(await records(source)).toEqual(before);
  });

  it('summarises local counts per category for the back up sheet', async () => {
    const database = openBackupDatabase();
    await seed(database);
    expect(await database.backup.summary()).toEqual({
      librarySongs: 1,
      songPresets: 2,
      setlists: 2,
      tunings: 1,
      practiceSessions: 1,
    });
  });

  it('exports only the requested categories', async () => {
    const database = openBackupDatabase();
    await seed(database);
    const file = JSON.parse(
      await database.backup.export(['tunings']),
    ) as Record<string, unknown>;
    expect(file).toMatchObject({ version: 4, categories: ['tunings'] });
    expect(file.setlists).toBeUndefined();
  });
});
