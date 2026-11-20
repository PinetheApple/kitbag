import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { bundle } from './backup-stem-songs.test-helper';
import { connectDatabase } from './client';
import { memoryClickSoundFiles } from './click-sound-files.test-helper';
import { unusedMigrationCopyFiles } from './migration-copy-files.test-helper';
import { fakeOpSqlite } from './op-sqlite-fake.test-helper';
import { createPlayQueueRepository } from './play-queue-repository';
import { createSetlistRepository } from './setlist-repository';
import { stemSets } from './schema';
import { replaceStemBundle } from './stem-bundle-repository';
import { createSongLibraryRepository } from './song-library-repository';
import { openTestDatabase } from './sqlite.test-helper';

const JOB = 'job-redbone';
const CRASH = expect.stringContaining('crash') as unknown;
const OTHER_JOB = 'job-redbone-remaster';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

type Repositories = Pick<
  ReturnType<typeof connectDatabase>,
  'setlists' | 'playQueue' | 'songLibrary'
>;

async function seed(repos: Repositories) {
  const old = await repos.songLibrary.insertStemBundle(bundle(JOB));
  const kept = await repos.songLibrary.insertStemBundle(bundle('job-other'));
  const gig = await repos.setlists.create('Gig');
  await repos.setlists.addStemSet(gig.id, old);
  await repos.setlists.addStemSet(gig.id, kept);
  await repos.setlists.addStemSet(gig.id, old);
  await repos.playQueue.add(kept);
  await repos.playQueue.add(old);
  const entries = async () => ({
    setlist: (await repos.setlists.items(gig.id)).map((item) => item.stemSetId),
    queue: (await repos.playQueue.list()).map((entry) => entry.stemSetId),
  });
  return { old, kept, entries };
}

function setup({ foreignKeys = true } = {}) {
  const handle = openTestDatabase({ foreignKeys });
  open.push(handle);
  const repos = {
    setlists: createSetlistRepository(handle),
    playQueue: createPlayQueueRepository(handle),
    songLibrary: createSongLibraryRepository(handle),
  };
  return { handle, repos };
}

function connected() {
  const { connection } = fakeOpSqlite();
  const database = connectDatabase(
    connection,
    memoryClickSoundFiles().files,
    unusedMigrationCopyFiles,
  );
  return { connection, database };
}

describe('stem song entries', () => {
  it.each([
    ['on', true],
    ['off', false],
  ])(
    'leave every setlist and the queue when the song is deleted, foreign keys %s',
    async (_, foreignKeys) => {
      const { repos } = setup({ foreignKeys });
      const { old, kept, entries } = await seed(repos);
      await repos.songLibrary.deleteStemSet(old);
      expect(await entries()).toEqual({ setlist: [kept], queue: [kept] });
    },
  );

  it.each([
    ['the same job', JOB],
    ['another job', OTHER_JOB],
  ])('follow a re-import of %s to the new stem set', async (_, jobId) => {
    const { repos } = setup();
    const { old, kept, entries } = await seed(repos);
    const { id } = await repos.songLibrary.replaceStemBundle(
      bundle(jobId),
      old,
    );
    expect(id).not.toBe(old);
    expect(await entries()).toEqual({
      setlist: [id, kept, id],
      queue: [kept, id],
    });
  });

  it('stay on the old set when a re-import fails midway on the app connection', async () => {
    const { connection, database } = connected();
    const { old, kept, entries } = await seed(database);
    const before = await entries();
    const setCount = async () =>
      (await connection.execute('SELECT count(*) AS n FROM stem_sets')).rows;
    const setsBefore = await setCount();
    await connection.execute(`CREATE TRIGGER crash BEFORE DELETE ON stem_sets
      BEGIN SELECT RAISE(ABORT, 'crash'); END`);
    await expect(
      database.songLibrary.replaceStemBundle(bundle(JOB), old),
    ).rejects.toHaveProperty('cause.message', CRASH);
    expect(await entries()).toEqual(before);
    expect(await setCount()).toEqual(setsBefore);
    expect(await database.songLibrary.findStemSetByJobId(JOB)).toEqual(
      expect.objectContaining({ id: old }),
    );

    await connection.execute('DROP TRIGGER crash');
    const { id } = await database.songLibrary.replaceStemBundle(
      bundle(JOB),
      old,
    );
    expect(await entries()).toEqual({
      setlist: [id, kept, id],
      queue: [kept, id],
    });
    await database.close();
  });

  it.each([
    ['inserting the new set', 'BEFORE INSERT ON stems'],
    ['moving the entries', 'BEFORE UPDATE ON play_queue'],
    ['deleting the old set', 'BEFORE DELETE ON stem_sets'],
  ])(
    'never dangle or drop when a run outside a transaction stops at %s',
    async (_, at) => {
      const { handle, repos } = setup();
      const { old, kept, entries } = await seed(repos);
      handle.connection.exec(
        `CREATE TRIGGER crash ${at} BEGIN SELECT RAISE(ABORT, 'crash'); END`,
      );
      await expect(
        replaceStemBundle(handle.db, bundle(JOB), old),
      ).rejects.toHaveProperty('cause.message', CRASH);
      const after = await entries();
      expect(after.setlist).toHaveLength(3);
      expect(after.queue).toHaveLength(2);
      const stored = new Set(
        (await handle.db.select({ id: stemSets.id }).from(stemSets)).map(
          (row) => row.id,
        ),
      );
      for (const id of [...after.setlist, ...after.queue])
        expect(stored).toContain(id);
      expect(after.setlist[1]).toBe(kept);
    },
  );
});
