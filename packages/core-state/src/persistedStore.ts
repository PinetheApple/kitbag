import { createStore, type StoreApi } from 'zustand/vanilla';

export type Commit<S> = <K extends keyof S, V extends S[K]>(
  key: K,
  value: V,
  save: (value: V) => void,
) => void;

export interface PersistedStore<P, S> {
  readonly create: (persistence?: P) => StoreApi<S>;
  readonly configure: (persistence: P) => void;
  readonly get: () => StoreApi<S>;
}

export function persistedStore<P, S>(
  name: string,
  inMemory: P,
  init: (persistence: P, commit: Commit<S>) => S,
): PersistedStore<P, S> {
  const create = (persistence: P = inMemory) =>
    createStore<S>((set, get) =>
      init(persistence, (key, value, save) => {
        if (get()[key] === value) return;
        const changed: Partial<S> = {};
        changed[key] = value;
        set(changed);
        save(value);
      }),
    );
  let configured: StoreApi<S> | undefined;
  return {
    create,
    configure: (persistence) => {
      if (configured !== undefined) {
        throw new Error(
          `${name} store already exists; configure persistence before first use`,
        );
      }
      configured = create(persistence);
    },
    get: () => {
      configured ??= create();
      return configured;
    },
  };
}
