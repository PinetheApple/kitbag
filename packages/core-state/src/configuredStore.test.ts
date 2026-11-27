import { describe, expect, it } from 'vitest';

import { persistedStore } from './persistedStore.ts';

interface Saved {
  readonly level: number;
  readonly setLevel: (level: number) => void;
}

function storeOver(stored: { level: number }) {
  return persistedStore<{ level: number }, Saved>(
    'Level',
    stored,
    (persistence, commit) => ({
      level: persistence.level,
      setLevel: (level) => {
        commit('level', level, (saved) => {
          persistence.level = saved;
        });
      },
    }),
  );
}

describe('reloading a configured store', () => {
  it('takes the values its storage now holds and keeps its actions working', () => {
    const stored = { level: 1 };
    const levels = storeOver({ level: 0 });
    levels.configure(stored);
    const store = levels.get();
    stored.level = 4;
    levels.reload();
    expect(store.getState().level).toBe(4);
    store.getState().setLevel(6);
    expect(store.getState().level).toBe(6);
    expect(stored.level).toBe(6);
  });

  it('does nothing before the store is first used', () => {
    const stored = { level: 2 };
    const levels = storeOver(stored);
    levels.reload();
    expect(levels.get().getState().level).toBe(2);
  });
});
