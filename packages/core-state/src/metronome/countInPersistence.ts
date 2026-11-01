import type { StoreApi } from 'zustand/vanilla';

import type { CountInConfig } from './config.ts';
import type { CountInScope } from './countInScope.ts';
import { metronomeStore, type MetronomeStore } from './store.ts';

export interface CountInSettings extends CountInConfig {
  readonly scope: CountInScope;
}

export interface CountInPersistence {
  readonly load: () => Partial<CountInSettings>;
  readonly save: (changed: Partial<CountInSettings>) => void;
}

const COUNT_IN_FIELDS = ['bars', 'distinct', 'sound'] as const;

function changedCountIn(
  next: CountInConfig,
  prev: CountInConfig,
): Partial<CountInConfig> {
  return Object.fromEntries(
    COUNT_IN_FIELDS.filter((field) => next[field] !== prev[field]).map(
      (field) => [field, next[field]],
    ),
  );
}

export function bindCountInPersistence(
  store: StoreApi<MetronomeStore>,
  persistence: CountInPersistence,
): () => void {
  const { scope, ...stored } = persistence.load();
  const state = store.getState();
  if (scope !== undefined) state.setCountInScope(scope);
  if (Object.keys(stored).length > 0)
    state.setCountIn({ ...state.countIn, ...stored });
  return store.subscribe((next, prev) => {
    const changed: Partial<CountInSettings> = {
      ...changedCountIn(next.countIn, prev.countIn),
      ...(next.countInScope === prev.countInScope
        ? {}
        : { scope: next.countInScope }),
    };
    if (Object.keys(changed).length > 0) persistence.save(changed);
  });
}

let unbind: (() => void) | undefined;

export function configureCountInPersistence(
  persistence: CountInPersistence,
): () => void {
  if (unbind !== undefined) {
    throw new Error('Count-in persistence is already configured');
  }
  unbind = bindCountInPersistence(metronomeStore, persistence);
  return unbind;
}
