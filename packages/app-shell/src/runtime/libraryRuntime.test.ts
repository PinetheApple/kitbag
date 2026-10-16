import { libraryStore } from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

const opens = vi.hoisted(() => ({ count: 0 }));

vi.mock('react-native', () => ({}));
vi.mock('expo-haptics', () => ({}));
vi.mock('@op-engineering/op-sqlite', () => ({}));

vi.mock('./database.ts', () => ({
  getDatabase: () => {
    opens.count += 1;
    throw new Error('migration failed');
  },
}));

describe('libraryRuntime', () => {
  it('opens nothing at import and reports a failed open as a library error', async () => {
    await import('./libraryRuntime');
    expect(opens.count).toBe(0);
    await expect(libraryStore.getState().refresh()).resolves.toBeUndefined();
    expect(libraryStore.getState()).toMatchObject({
      ready: true,
      failed: true,
    });
  });
});
