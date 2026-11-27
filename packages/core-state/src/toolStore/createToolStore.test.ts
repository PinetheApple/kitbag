import { describe, expect, it, vi } from 'vitest';

import { createToolStore } from './createToolStore.ts';

interface Drill {
  readonly reps: number;
  readonly label: string;
}

const START: Drill = { reps: 0, label: 'Warm-up' };

describe('createToolStore', () => {
  it('starts from the initial state', () => {
    expect(createToolStore(START).getState()).toEqual(START);
  });

  it('merges a partial update and leaves the initial object alone', () => {
    const store = createToolStore(START);
    store.setState({ reps: 4 });
    expect(store.getState()).toEqual({ reps: 4, label: 'Warm-up' });
    expect(START.reps).toBe(0);
  });

  it('applies an updater to the current state', () => {
    const store = createToolStore(START);
    store.setState((drill) => ({ reps: drill.reps + 1 }));
    store.setState((drill) => ({ reps: drill.reps + 1 }));
    expect(store.getState().reps).toBe(2);
  });

  it('tells subscribers the next and previous state', () => {
    const store = createToolStore(START);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.setState({ label: 'Scales' });
    unsubscribe();
    store.setState({ label: 'Arpeggios' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ reps: 0, label: 'Scales' }, START);
  });

  it('keeps each store separate', () => {
    const first = createToolStore(START);
    const second = createToolStore(START);
    first.setState({ reps: 9 });
    expect(second.getState().reps).toBe(0);
  });
});
