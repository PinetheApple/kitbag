import { describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { MS_PER_SECOND } from './backup-format';
import { connectDatabase } from './client';
import { fakeOpSqlite } from './op-sqlite-fake.test-helper';
import type { NewPracticeSession } from './practice-repository';

const STARTED_AT = new Date('2026-11-01T18:00:00Z');

function open() {
  const { connection } = fakeOpSqlite();
  return connectDatabase(connection);
}

function session(
  overrides: Partial<NewPracticeSession> = {},
): NewPracticeSession {
  return {
    uuid: crypto.randomUUID(),
    startedAt: STARTED_AT,
    durationSeconds: 1500,
    avgBpm: 112.5,
    setlistId: null,
    songUuids: [],
    ...overrides,
  };
}

async function rows(database: ReturnType<typeof open>) {
  const file = JSON.parse(await database.backup.export()) as {
    practiceSessions: Record<string, unknown>[];
  };
  return file.practiceSessions;
}

describe('practice.insert', () => {
  it('writes the session with its setlist and songs in played order', async () => {
    const database = open();
    const friday = await database.setlists.create('Friday');
    const record = session({
      setlistId: friday.id,
      songUuids: ['b-song', 'a-song'],
    });
    await database.practice.insert(record);
    expect(await rows(database)).toEqual([
      {
        uuid: record.uuid,
        startTime: STARTED_AT.getTime() / MS_PER_SECOND,
        durationSeconds: 1500,
        avgBpm: 112.5,
        setlistUuid: friday.uuid,
        songsPlayed: JSON.stringify(['b-song', 'a-song']),
      },
    ]);
    await database.close();
  });

  it('stores no songs as null', async () => {
    const database = open();
    await database.practice.insert(session());
    expect(await rows(database)).toMatchObject([{ songsPlayed: null }]);
    await database.close();
  });

  it('ignores a second insert of the same uuid', async () => {
    const database = open();
    const record = session();
    await database.practice.insert(record);
    await database.practice.insert({ ...record, durationSeconds: 9 });
    expect(await rows(database)).toMatchObject([
      { uuid: record.uuid, durationSeconds: 1500 },
    ]);
    expect(await database.practice.stats()).toMatchObject({ sessions: 1 });
    await database.close();
  });

  it('drops a setlist deleted before the save instead of failing it', async () => {
    const database = open();
    const gone = await database.setlists.create('Gone');
    await database.setlists.delete(gone.id);
    await database.practice.insert(session({ setlistId: gone.id }));
    expect(await rows(database)).toMatchObject([{ setlistUuid: null }]);
    await database.close();
  });
});
