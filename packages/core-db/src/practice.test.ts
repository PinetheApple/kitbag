import { afterEach, describe, expect, it } from 'vitest';

import { createPracticeRepository } from './practice-repository';
import { practiceSessions } from './schema';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return { handle, repo: createPracticeRepository(handle) };
}

type Session = Pick<
  typeof practiceSessions.$inferInsert,
  'durationSeconds' | 'avgBpm'
>;

async function insert(
  handle: ReturnType<typeof openTestDatabase>,
  sessions: readonly Session[],
) {
  await handle.db.insert(practiceSessions).values(
    sessions.map((session) => ({
      ...session,
      startTime: new Date(0),
      uuid: crypto.randomUUID(),
    })),
  );
}

describe('practiceStats', () => {
  it('reports no sessions and no average on an empty table', async () => {
    const { repo } = setup();
    expect(await repo.stats()).toEqual({
      sessions: 0,
      totalSeconds: 0,
      avgBpm: null,
    });
  });

  it('reports a single session as-is', async () => {
    const { handle, repo } = setup();
    await insert(handle, [{ durationSeconds: 600, avgBpm: 96 }]);
    expect(await repo.stats()).toEqual({
      sessions: 1,
      totalSeconds: 600,
      avgBpm: 96,
    });
  });

  it('weights the average by duration', async () => {
    const { handle, repo } = setup();
    await insert(handle, [
      { durationSeconds: 3000, avgBpm: 120 },
      { durationSeconds: 1000, avgBpm: 80 },
    ]);
    expect(await repo.stats()).toEqual({
      sessions: 2,
      totalSeconds: 4000,
      avgBpm: 110,
    });
  });

  it('counts zero-length sessions without letting them move the average', async () => {
    const { handle, repo } = setup();
    await insert(handle, [
      { durationSeconds: 900, avgBpm: 100 },
      { durationSeconds: 0, avgBpm: 240 },
    ]);
    expect(await repo.stats()).toEqual({
      sessions: 2,
      totalSeconds: 900,
      avgBpm: 100,
    });
  });

  it('has no average when every session is zero-length', async () => {
    const { handle, repo } = setup();
    await insert(handle, [
      { durationSeconds: 0, avgBpm: 90 },
      { durationSeconds: 0, avgBpm: 130 },
    ]);
    expect(await repo.stats()).toEqual({
      sessions: 2,
      totalSeconds: 0,
      avgBpm: null,
    });
  });
});
