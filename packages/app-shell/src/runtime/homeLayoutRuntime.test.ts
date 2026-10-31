import type { Preferences } from '@kitbag/core-db';
import { getHomeLayoutStore } from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

const stored = vi.hoisted(
  () =>
    new Map([
      ['home_layout', '[{"toolId":"tuner","size":"2x1","hidden":false}]'],
    ]),
);

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

describe('homeLayoutRuntime', () => {
  it('installs database persistence on import, before Home first reads it', async () => {
    await import('./homeLayoutRuntime');
    const store = getHomeLayoutStore();
    expect(store.getState().arrangement).toEqual([
      { toolId: 'tuner', size: '2x1', hidden: false },
    ]);

    store.getState().arrange([{ toolId: 'stems', size: '1x1', hidden: true }]);
    expect(stored.get('home_layout')).toBe(
      '[{"toolId":"stems","size":"1x1","hidden":true}]',
    );
  });
});
