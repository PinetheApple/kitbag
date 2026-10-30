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
): ReduceMotionStore {
  const listeners = new Set<() => void>();
  let enabled = false;
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
  void source.isReduceMotionEnabled().then((initial) => {
    if (!changed) set(initial);
  });

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
