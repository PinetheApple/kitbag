export interface ReduceMotionSource {
  isReduceMotionEnabled(): Promise<boolean>;
  addEventListener(
    event: 'reduceMotionChanged',
    handler: (enabled: boolean) => void,
  ): { remove(): void };
}

export interface ReduceMotionStore {
  readonly get: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createReduceMotionStore(
  source: ReduceMotionSource,
  initial: boolean,
): ReduceMotionStore {
  const listeners = new Set<() => void>();
  let enabled = initial;
  let changed = false;

  const set = (next: boolean) => {
    if (next === enabled) return;
    enabled = next;
    for (const listener of listeners) listener();
  };

  source.addEventListener('reduceMotionChanged', (next) => {
    changed = true;
    set(next);
  });
  source
    .isReduceMotionEnabled()
    .then((seeded) => {
      if (!changed) set(seeded);
    })
    .catch(() => undefined);

  return {
    get: () => enabled,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function bindToValue(
  store: ReduceMotionStore,
  setter: (enabled: boolean) => void,
): () => void {
  return store.subscribe(() => {
    setter(store.get());
  });
}
