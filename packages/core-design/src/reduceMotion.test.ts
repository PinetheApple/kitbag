import { describe, expect, it, vi } from 'vitest';

import {
  createReduceMotionStore,
  type ReduceMotionSource,
} from './reduceMotion.ts';

function fakeAccessibilityInfo(initial: boolean) {
  const handlers = new Set<(enabled: boolean) => void>();
  let resolveInitial: (enabled: boolean) => void = () => undefined;
  const pending = new Promise<boolean>((resolve) => {
    resolveInitial = resolve;
  });
  const source: ReduceMotionSource = {
    isReduceMotionEnabled: () => pending,
    addEventListener: (_event, handler) => {
      handlers.add(handler);
      return {
        remove: () => {
          handlers.delete(handler);
        },
      };
    },
  };
  return {
    source,
    settle: async () => {
      resolveInitial(initial);
      await pending;
    },
    emit: (enabled: boolean) => {
      for (const handler of handlers) handler(enabled);
    },
  };
}

describe('createReduceMotionStore', () => {
  it('seeds from isReduceMotionEnabled', async () => {
    const fake = fakeAccessibilityInfo(true);
    const store = createReduceMotionStore(fake.source);
    await fake.settle();
    expect(store.get()).toBe(true);
  });

  it('follows reduceMotionChanged and notifies subscribers', async () => {
    const fake = fakeAccessibilityInfo(false);
    const store = createReduceMotionStore(fake.source);
    await fake.settle();
    const listener = vi.fn();
    store.subscribe(listener);

    fake.emit(true);
    expect(store.get()).toBe(true);
    fake.emit(false);
    expect(store.get()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps a change that lands before the initial read resolves', async () => {
    const fake = fakeAccessibilityInfo(false);
    const store = createReduceMotionStore(fake.source);
    fake.emit(true);
    await fake.settle();
    expect(store.get()).toBe(true);
  });

  it('stops notifying an unsubscribed listener', async () => {
    const fake = fakeAccessibilityInfo(false);
    const store = createReduceMotionStore(fake.source);
    await fake.settle();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    fake.emit(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
