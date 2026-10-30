import { describe, expect, it, vi } from 'vitest';

import {
  bindToValue,
  createReduceMotionStore,
  type ReduceMotionSource,
} from './reduceMotion.ts';

function fakeAccessibilityInfo(seed: Promise<boolean>) {
  const handlers = new Set<(enabled: boolean) => void>();
  const source: ReduceMotionSource = {
    isReduceMotionEnabled: () => seed,
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
    emit: (enabled: boolean) => {
      for (const handler of handlers) handler(enabled);
    },
  };
}

function deferred() {
  let resolve: (enabled: boolean) => void = () => undefined;
  const promise = new Promise<boolean>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function flushSeed(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

describe('createReduceMotionStore', () => {
  it('returns the launch value before the seed read resolves', () => {
    const fake = fakeAccessibilityInfo(deferred().promise);
    const store = createReduceMotionStore(fake.source, true);
    expect(store.get()).toBe(true);
  });

  it('corrects the launch value from the seed read', async () => {
    const fake = fakeAccessibilityInfo(Promise.resolve(true));
    const store = createReduceMotionStore(fake.source, false);
    await flushSeed();
    expect(store.get()).toBe(true);
  });

  it('keeps the launch value when the seed read rejects', async () => {
    const fake = fakeAccessibilityInfo(Promise.reject(new Error('no module')));
    const store = createReduceMotionStore(fake.source, true);
    await flushSeed();
    expect(store.get()).toBe(true);
  });

  it('follows reduceMotionChanged and notifies subscribers', async () => {
    const fake = fakeAccessibilityInfo(Promise.resolve(false));
    const store = createReduceMotionStore(fake.source, false);
    await flushSeed();
    const listener = vi.fn();
    store.subscribe(listener);

    fake.emit(true);
    expect(store.get()).toBe(true);
    fake.emit(false);
    expect(store.get()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps a change that lands before the seed read resolves', async () => {
    const seed = deferred();
    const fake = fakeAccessibilityInfo(seed.promise);
    const store = createReduceMotionStore(fake.source, false);
    fake.emit(true);
    seed.resolve(false);
    await flushSeed();
    expect(store.get()).toBe(true);
  });

  it('stops notifying an unsubscribed listener', async () => {
    const fake = fakeAccessibilityInfo(Promise.resolve(false));
    const store = createReduceMotionStore(fake.source, false);
    await flushSeed();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    fake.emit(true);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('bindToValue', () => {
  it('pushes a change event through to the setter', async () => {
    const fake = fakeAccessibilityInfo(Promise.resolve(false));
    const store = createReduceMotionStore(fake.source, false);
    await flushSeed();
    const setter = vi.fn();
    bindToValue(store, setter);

    fake.emit(true);
    expect(setter).toHaveBeenLastCalledWith(true);
    fake.emit(false);
    expect(setter).toHaveBeenLastCalledWith(false);
  });
});
