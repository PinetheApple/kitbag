import type { Preferences } from '@kitbag/core-db';
import { getLastToolStore } from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

const stored = vi.hoisted(() => new Map([['last_tool', 'tuner']]));

vi.mock('./database', () => ({
  getDatabase: () => ({
    preferences: {
      get: (key: string) => stored.get(key),
      set: (key: string, value: string) => {
        stored.set(key, value);
        return Promise.resolve();
      },
    } satisfies Preferences,
  }),
}));

describe('lastToolRuntime', () => {
  it('installs database persistence on import, before the first read', async () => {
    await import('./lastToolRuntime');
    const store = getLastToolStore();
    expect(store.getState().toolId).toBe('tuner');

    store.getState().markUsed('metronome');
    expect(stored.get('last_tool')).toBe('metronome');
  });
});
