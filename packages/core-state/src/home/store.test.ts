import { describe, expect, it, vi } from 'vitest';

import type { ArrangedTile } from './arrangement.ts';
import { createHomeLayoutStore, type HomeLayoutPersistence } from './store.ts';

const SAVED: readonly ArrangedTile<string>[] = [
  { toolId: 'tuner', size: '2x1', hidden: false },
  { toolId: 'metronome', size: '1x1', hidden: true },
];

function fakePersistence(initial?: readonly ArrangedTile<string>[]) {
  const save = vi.fn<HomeLayoutPersistence['save']>();
  const persistence: HomeLayoutPersistence = { load: () => initial, save };
  return { persistence, save };
}

describe('home layout store', () => {
  it('has no saved layout when storage is empty, so Home uses its default', () => {
    const { persistence } = fakePersistence();
    expect(
      createHomeLayoutStore(persistence).getState().arrangement,
    ).toBeUndefined();
  });

  it('restores the layout storage remembered', () => {
    const { persistence } = fakePersistence(SAVED);
    expect(createHomeLayoutStore(persistence).getState().arrangement).toEqual(
      SAVED,
    );
  });

  it('records and saves a new layout', () => {
    const { persistence, save } = fakePersistence();
    const store = createHomeLayoutStore(persistence);
    store.getState().arrange(SAVED);
    expect(store.getState().arrangement).toBe(SAVED);
    expect(save).toHaveBeenCalledWith(SAVED);
  });

  it('survives a restart through the same storage', () => {
    let stored: readonly ArrangedTile<string>[] | undefined;
    const persistence: HomeLayoutPersistence = {
      load: () => stored,
      save: (arrangement) => {
        stored = arrangement;
      },
    };
    createHomeLayoutStore(persistence).getState().arrange(SAVED);
    expect(createHomeLayoutStore(persistence).getState().arrangement).toEqual(
      SAVED,
    );
  });

  it('skips the write when the layout is the one already held', () => {
    const { persistence, save } = fakePersistence(SAVED);
    const store = createHomeLayoutStore(persistence);
    store.getState().arrange(store.getState().arrangement ?? []);
    expect(save).not.toHaveBeenCalled();
  });
});
