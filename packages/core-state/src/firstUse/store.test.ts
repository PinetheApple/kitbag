import { describe, expect, it, vi } from 'vitest';

import { createSwipeHintStore, type SwipeHintPersistence } from './store.ts';

function fakePersistence(seen: boolean) {
  const save = vi.fn<() => void>();
  const persistence: SwipeHintPersistence = { load: () => seen, save };
  return { persistence, save };
}

describe('first-use swipe hint', () => {
  it('shows on a fresh install', () => {
    const { persistence } = fakePersistence(false);
    expect(createSwipeHintStore(persistence).getState().seen).toBe(false);
  });

  it('stays dismissed across launches', () => {
    const { persistence } = fakePersistence(true);
    expect(createSwipeHintStore(persistence).getState().seen).toBe(true);
  });

  it('saves the dismissal once, however often it is dismissed', () => {
    const { persistence, save } = fakePersistence(false);
    const store = createSwipeHintStore(persistence);
    store.getState().dismiss();
    store.getState().dismiss();
    expect(store.getState().seen).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
