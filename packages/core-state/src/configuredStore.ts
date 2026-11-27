import { createStore, type StoreApi } from 'zustand/vanilla';

export type StoreAccess<S> = Pick<StoreApi<S>, 'getState' | 'setState'>;

export interface ConfiguredStore<R, S> {
  readonly create: (runtime?: R) => StoreApi<S>;
  readonly configure: (runtime: R) => void;
  readonly get: () => StoreApi<S>;
  readonly reload: () => void;
}

const withoutActions = <S>(state: S): Partial<S> =>
  Object.fromEntries(
    Object.entries(state as object).filter(
      ([, value]) => typeof value !== 'function',
    ),
  ) as Partial<S>;

export function configuredStore<R, S>(
  name: string,
  fallback: R,
  init: (runtime: R, access: StoreAccess<S>) => S,
): ConfiguredStore<R, S> {
  const create = (runtime: R = fallback) =>
    createStore<S>((set, get) =>
      init(runtime, { getState: get, setState: set }),
    );
  let configured: StoreApi<S> | undefined;
  let configuredRuntime = fallback;
  return {
    create,
    configure: (runtime) => {
      if (configured !== undefined) {
        throw new Error(
          `${name} store already exists; configure it before first use`,
        );
      }
      configuredRuntime = runtime;
      configured = create(runtime);
    },
    get: () => {
      configured ??= create();
      return configured;
    },
    reload: () => {
      configured?.setState(
        withoutActions(create(configuredRuntime).getState()),
      );
    },
  };
}
