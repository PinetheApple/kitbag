import { describe, expect, it } from 'vitest';

import { CATEGORIES } from './backup-format';
import {
  openBackupDatabase,
  records,
  seed,
  SESSION_START,
  type BackupDatabase,
  unwrap,
} from './backup.test-helper';
import type { SongPreset } from './repository';
import { practiceSessions, songs, tunings } from './schema';
import { INSTRUMENTS } from './tuning-rules';

async function restoreAll(target: BackupDatabase, file: string) {
  const plan = unwrap(
    await target.backup.plan(file, { categories: CATEGORIES }),
  );
  return target.backup.apply(plan);
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

  it('owes a restored song an analysis only when it arrives without a grid', async () => {
    const source = openBackupDatabase();
    await seed(source);
    await source.handle.db.insert(songs).values({
      title: 'Ungridded',
      artist: '',
      filePath: 'songs/u/u.mp3',
      duration: 1,
      format: 'mp3',
      createdAt: SESSION_START,
      uuid: crypto.randomUUID(),
    });
    const target = openBackupDatabase();
    await restoreAll(target, await source.backup.export());
    const restored = await target.handle.db
      .select({ title: songs.title, status: songs.analysisStatus })
      .from(songs);
    expect(restored).toEqual([
      { title: 'Reference', status: 'done' },
      { title: 'Ungridded', status: 'pending' },
    ]);
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

  it('summarizes local counts per category for the back up sheet', async () => {
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

  it('restores a tuning with its instrument', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const target = openBackupDatabase();
    await restoreAll(target, await source.backup.export());
    const [tuning] = await target.handle.db.select().from(tunings);
    expect(tuning).toMatchObject({
      name: 'Drop D',
      instrument: INSTRUMENTS.bass,
    });
  });

  it('reads a v4 tuning written before instruments existed as guitar', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const file = JSON.parse(await source.backup.export(['tunings'])) as {
      tunings: Record<string, unknown>[];
    };
    for (const record of file.tunings) delete record.instrument;
    const target = openBackupDatabase();
    const plan = unwrap(
      await target.backup.plan(JSON.stringify(file), {
        categories: ['tunings'],
      }),
    );
    expect((await target.backup.apply(plan)).ok).toBe(true);
    const [tuning] = await target.handle.db.select().from(tunings);
    expect(tuning).toMatchObject({
      name: 'Drop D',
      instrument: INSTRUMENTS.guitar,
    });
  });

  it('reads a v4 preset written before ramp units, its rampBars as a bar ramp without loop', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const file = JSON.parse(await source.backup.export()) as {
      songPresets: Record<string, unknown>[];
    };
    for (const record of file.songPresets) {
      delete record.rampUnit;
      delete record.rampLoop;
      delete record.rampLength;
      record.rampBars = 8;
    }
    const target = openBackupDatabase();
    const plan = unwrap(
      await target.backup.plan(JSON.stringify(file), {
        categories: CATEGORIES,
      }),
    );
    expect((await target.backup.apply(plan)).ok).toBe(true);
    const [preset] = await target.presets.list();
    expect(preset).toMatchObject({
      rampLength: 8,
      rampUnit: 0,
      rampLoop: false,
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
