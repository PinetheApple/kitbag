import { MS_PER_SECOND } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

const database = vi.hoisted(() => ({
  open: (): unknown => {
    throw new Error('migration failed');
  },
}));

vi.mock('./database', () => ({
  getDatabase: () => database.open(),
}));

const SESSION = {
  uuid: 'session',
  startedAt: new Date(0),
  durationSeconds: 60,
  avgBpm: 100,
  setlistId: null,
  songUuids: [],
};

describe('readPracticeStats', () => {
  it('turns a failed database open into a rejection', async () => {
    const { readPracticeStats } = await import('./practiceRuntime');
    let read: Promise<unknown> | undefined;
    expect(() => {
      read = readPracticeStats();
    }).not.toThrow();
    await expect(read).rejects.toThrow('migration failed');
  });
});

describe('savePracticeSession', () => {
  it('turns a failed database open into a rejection', async () => {
    const { savePracticeSession } = await import('./practiceRuntime');
    let save: Promise<unknown> | undefined;
    expect(() => {
      save = savePracticeSession(SESSION);
    }).not.toThrow();
    await expect(save).rejects.toThrow('migration failed');
  });

  it('is what the practice session store saves through', async () => {
    const insert = vi.fn(() => Promise.resolve());
    database.open = () => ({ practice: { insert } });
    await import('./practiceRuntime');
    const { getPracticeSessionStore, metronomeStore } =
      await import('@kitbag/core-state');
    const practice = getPracticeSessionStore().getState();
    vi.useFakeTimers();
    metronomeStore.setState({ running: true });
    vi.advanceTimersByTime(MS_PER_SECOND);
    metronomeStore.setState({ running: false });
    vi.useRealTimers();
    practice.endSession();
    await getPracticeSessionStore().getState().saveSession();
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
