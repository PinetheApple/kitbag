import { afterEach, describe, expect, it } from 'vitest';

import {
  PRACTICE_LOG_VERSION,
  STRETCH_END,
  type PracticeLog,
} from './practice-log';
import {
  createPracticeRepository,
  type NewPracticeSession,
} from './practice-repository';
import { practiceSessions } from './schema';
import { createSetlistRepository } from './setlist-repository';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return {
    handle,
    repo: createPracticeRepository(handle),
    sets: createSetlistRepository(handle),
  };
}

const LOG: PracticeLog = {
  v: PRACTICE_LOG_VERSION,
  stretches: [
    {
      from: 0,
      to: 151_000,
      end: STRETCH_END.song,
      song: { uuid: 'opener', title: 'First dance' },
      setlist: { uuid: 'wedding', name: 'Wedding set', position: 1 },
      settings: null,
      countIn: null,
      tempo: [[60_000, 72]],
      endBpm: 72,
      avgBpm: 70,
    },
  ],
};

const withoutLog = (saved: NewPracticeSession) =>
  Object.fromEntries(Object.entries(saved).filter(([key]) => key !== 'log'));

function session(
  startedAt: string,
  overrides: Partial<NewPracticeSession> = {},
): NewPracticeSession {
  return {
    uuid: crypto.randomUUID(),
    startedAt: new Date(startedAt),
    durationSeconds: 600,
    avgBpm: 96,
    setlistId: null,
    setlistName: null,
    songUuids: ['opener'],
    log: LOG,
    ...overrides,
  };
}

describe('practice history', () => {
  it('lists sessions newest first, without their logs', async () => {
    const { repo } = setup();
    const older = session('2026-10-29T18:30:00Z');
    const newer = session('2026-11-02T19:40:00Z', { setlistName: 'Wedding' });
    await repo.insert(older);
    await repo.insert(newer);
    expect(await repo.list()).toEqual([newer, older].map(withoutLog));
  });

  it('gets one session with its log', async () => {
    const { repo } = setup();
    const saved = session('2026-11-02T19:40:00Z');
    await repo.insert(saved);
    expect(await repo.get(saved.uuid)).toEqual(saved);
    expect(await repo.get(crypto.randomUUID())).toBeUndefined();
  });

  it('reads a session saved before logs as having none', async () => {
    const { handle, repo } = setup();
    const uuid = crypto.randomUUID();
    await handle.db.insert(practiceSessions).values({
      uuid,
      startTime: new Date(0),
      durationSeconds: 60,
      avgBpm: 100,
    });
    expect(await repo.get(uuid)).toMatchObject({
      log: null,
      setlistName: null,
      songUuids: [],
    });
  });

  it('reads a log it cannot understand as none', async () => {
    const { handle, repo } = setup();
    const uuid = crypto.randomUUID();
    await handle.db.insert(practiceSessions).values({
      uuid,
      startTime: new Date(0),
      durationSeconds: 60,
      avgBpm: 100,
      log: JSON.stringify({ v: PRACTICE_LOG_VERSION + 1, stretches: [] }),
    });
    expect((await repo.get(uuid))?.log).toBeNull();
  });

  it('keeps the setlist name once the setlist is deleted', async () => {
    const { repo, sets } = setup();
    const wedding = await sets.create('Wedding set');
    const saved = session('2026-11-02T19:40:00Z', {
      setlistId: wedding.id,
      setlistName: wedding.name,
    });
    await repo.insert(saved);
    await sets.delete(wedding.id);
    expect(await repo.get(saved.uuid)).toMatchObject({
      setlistId: null,
      setlistName: 'Wedding set',
    });
  });

  it('deletes a session and restores it on undo', async () => {
    const { repo } = setup();
    const kept = session('2026-11-01T08:05:00Z');
    const saved = session('2026-11-02T19:40:00Z');
    await repo.insert(kept);
    await repo.insert(saved);
    const deleted = await repo.delete(saved.uuid);
    expect(deleted?.session).toEqual(saved);
    expect(await repo.get(saved.uuid)).toBeUndefined();
    expect((await repo.stats()).sessions).toBe(1);
    if (deleted === undefined) throw new Error('nothing deleted');
    await repo.restore(deleted);
    expect(await repo.get(saved.uuid)).toEqual(saved);
    expect((await repo.list()).map((row) => row.uuid)).toEqual([
      saved.uuid,
      kept.uuid,
    ]);
  });

  it('restores the stored text on undo, even text it cannot read', async () => {
    const { handle, repo } = setup();
    const uuid = crypto.randomUUID();
    await handle.db.insert(practiceSessions).values({
      uuid,
      startTime: new Date(0),
      durationSeconds: 60,
      avgBpm: 100,
      songsPlayed: '[1, "opener"]',
      log: '{not json',
    });
    const stored = () =>
      handle.db
        .select({
          songsPlayed: practiceSessions.songsPlayed,
          log: practiceSessions.log,
        })
        .from(practiceSessions);
    const before = await stored();
    const deleted = await repo.delete(uuid);
    if (deleted === undefined) throw new Error('nothing deleted');
    await repo.restore(deleted);
    expect(await stored()).toEqual(before);
  });

  it('deletes nothing for an unknown session', async () => {
    const { repo } = setup();
    await repo.insert(session('2026-11-02T19:40:00Z'));
    expect(await repo.delete(crypto.randomUUID())).toBeUndefined();
    expect((await repo.stats()).sessions).toBe(1);
  });
});
