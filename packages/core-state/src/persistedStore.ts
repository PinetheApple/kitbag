import {
  configuredStore,
  type ConfiguredStore,
  type StoreAccess,
} from './configuredStore.ts';

export type Commit<S> = <K extends keyof S, V extends S[K]>(
  key: K,
  value: V,
  save: (value: V) => void,
) => void;

export type PersistedStore<P, S> = ConfiguredStore<P, S>;

export function persistedStore<P, S>(
  name: string,
  inMemory: P,
  init: (persistence: P, commit: Commit<S>, transient: StoreAccess<S>) => S,
): PersistedStore<P, S> {
  return configuredStore<P, S>(name, inMemory, (persistence, access) =>
    init(
      persistence,
      (key, value, save) => {
        if (access.getState()[key] === value) return;
        const changed: Partial<S> = {};
        changed[key] = value;
        access.setState(changed);
        save(value);
      },
      access,
    ),
  );
}
