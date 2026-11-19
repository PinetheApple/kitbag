import { createPracticeRepository } from '@kitbag/core-db/src/practice-repository';
import { practiceSessions } from '@kitbag/core-db/src/schema';
import { openTestDatabase } from '@kitbag/core-db/src/sqlite.test-helper';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPracticeHistoryStore } from './historyList.ts';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

async function history() {
  const handle = openTestDatabase();
  open.push(handle);
  const repo = createPracticeRepository(handle);
  const row = (uuid: string, startTime: Date, log: string | null) =>
    handle.db.insert(practiceSessions).values({
      uuid,
      startTime,
      durationSeconds: 600,
      avgBpm: 100,
      songsPlayed: '[1, "opener"]',
      log,
    });
  await row('older', new Date(2026, 9, 29), null);
  await row('newer', new Date(2026, 10, 2), '{not json');
  const raw = () => handle.db.select().from(practiceSessions);
  const store = createPracticeHistoryStore(() => repo);
  await store.getState().refresh();
  return { store, raw };
}

function failing(fail: 'list' | 'delete' | 'restore') {
  const reject = () => Promise.reject(new Error(fail));
  return {
    list: fail === 'list' ? reject : () => Promise.resolve([]),
    stats: () =>
      Promise.resolve({ sessions: 0, totalSeconds: 0, avgBpm: null }),
    get: () => Promise.resolve(undefined),
    delete: fail === 'delete' ? reject : () => Promise.resolve(undefined),
    restore: fail === 'restore' ? reject : () => Promise.resolve(),
  };
}

describe('practice history list', () => {
  it('lists newest first with the totals', async () => {
    const { store } = await history();
    const { sessions, stats } = store.getState();
    expect(sessions.map((s) => s.uuid)).toEqual(['newer', 'older']);
    expect(stats).toMatchObject({ sessions: 2, totalSeconds: 1200 });
  });

  it('deletes a row and updates the list and totals at once', async () => {
    const { store } = await history();
    await store.getState().remove('newer');
    const { sessions, stats, deleted } = store.getState();
    expect(sessions.map((s) => s.uuid)).toEqual(['older']);
    expect(stats?.sessions).toBe(1);
    expect(deleted?.session.uuid).toBe('newer');
  });

  it('puts back exactly the row it deleted on Undo', async () => {
    const { store, raw } = await history();
    const before = await raw();
    await store.getState().remove('newer');
    await store.getState().undo();
    const after = await raw();
    const strip = (rows: typeof before) =>
      rows
        .sort((a, b) => a.uuid.localeCompare(b.uuid))
        .map((row) =>
          Object.fromEntries(
            Object.entries(row).filter(([key]) => key !== 'id'),
          ),
        );
    expect(strip(after)).toEqual(strip(before));
    expect(store.getState().sessions.map((s) => s.uuid)).toEqual([
      'newer',
      'older',
    ]);
    expect(store.getState().deleted).toBeNull();
  });

  it('forgets the deleted row once the snackbar goes', async () => {
    const { store } = await history();
    await store.getState().remove('newer');
    store.getState().dismissDeleted();
    await store.getState().undo();
    expect(store.getState().sessions.map((s) => s.uuid)).toEqual(['older']);
  });
});

describe('practice history failures', () => {
  it('reads as failed, not empty, when the list cannot load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createPracticeHistoryStore(() => failing('list'));
    await store.getState().refresh();
    expect(store.getState()).toMatchObject({ ready: true, failed: true });
    warn.mockRestore();
  });

  it('keeps the deleted session for another Undo when the restore fails', async () => {
    const { store } = await history();
    await store.getState().remove('newer');
    const deleted = store.getState().deleted;
    const broken = createPracticeHistoryStore(() => failing('restore'));
    broken.setState({ deleted });
    await expect(broken.getState().undo()).rejects.toThrow('restore');
    expect(broken.getState().deleted).toBe(deleted);
  });

  it('reports a failed delete to the caller and keeps the row', async () => {
    const store = createPracticeHistoryStore(() => failing('delete'));
    await expect(store.getState().remove('newer')).rejects.toThrow('delete');
    expect(store.getState().deleted).toBeNull();
  });
});
