import { describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

vi.mock('./database', () => ({
  getDatabase: () => {
    throw new Error('migration failed');
  },
}));

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
