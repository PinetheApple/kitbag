import { describe, expect, it } from 'vitest';

import { CATEGORIES } from './backup-format';
import {
  openBackupDatabase,
  seed,
  SEEDED_PRACTICE_LOG,
  type BackupDatabase,
  unwrap,
} from './backup.test-helper';
import { createPracticeRepository } from './practice-repository';
import { practiceSessions } from './schema';

const EVERYTHING = { categories: CATEGORIES };

type FileRecords = Record<string, unknown> & {
  practiceSessions: Record<string, unknown>[];
};

async function exported(database: BackupDatabase): Promise<FileRecords> {
  return JSON.parse(await database.backup.export()) as FileRecords;
}

async function restore(target: BackupDatabase, file: FileRecords) {
  const plan = unwrap(
    await target.backup.plan(JSON.stringify(file), EVERYTHING),
  );
  expect((await target.backup.apply(plan)).ok).toBe(true);
}

const sessionsOf = (database: BackupDatabase) =>
  database.handle.db
    .select({
      setlistName: practiceSessions.setlistName,
      log: practiceSessions.log,
    })
    .from(practiceSessions);

describe('practice sessions in a backup', () => {
  it('carries the log and setlist name through a round trip', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const target = openBackupDatabase();
    await restore(target, await exported(source));
    const [restored] = await createPracticeRepository(target.handle).list();
    expect(
      await createPracticeRepository(target.handle).get(restored?.uuid ?? ''),
    ).toMatchObject({ setlistName: 'Friday', log: SEEDED_PRACTICE_LOG });
  });

  it('restores a session from a file without them as having neither', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const file = await exported(source);
    for (const record of file.practiceSessions) {
      delete record.setlistName;
      delete record.log;
    }
    const target = openBackupDatabase();
    await restore(target, file);
    expect(await sessionsOf(target)).toEqual([
      { setlistName: null, log: null },
    ]);
  });

  it('finds the same file unchanged and a changed log in conflict', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const file = await exported(source);
    const same = unwrap(
      await source.backup.plan(JSON.stringify(file), EVERYTHING),
    );
    expect(same.counts.practiceSessions).toMatchObject({
      unchanged: 1,
      conflicts: [],
    });
    const [record] = file.practiceSessions;
    if (record === undefined) throw new Error('no practice record exported');
    record.log = JSON.stringify({ ...SEEDED_PRACTICE_LOG, stretches: [] });
    const changed = unwrap(
      await source.backup.plan(JSON.stringify(file), EVERYTHING),
    );
    expect(changed.counts.practiceSessions?.conflicts).toHaveLength(1);
  });

  it('refuses a log that is not text', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const file = await exported(source);
    const [record] = file.practiceSessions;
    if (record === undefined) throw new Error('no practice record exported');
    record.log = { v: 1 };
    const result = await source.backup.plan(JSON.stringify(file), EVERYTHING);
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'invalidField',
        path: '$.practiceSessions[0].log',
      },
    });
  });
});
