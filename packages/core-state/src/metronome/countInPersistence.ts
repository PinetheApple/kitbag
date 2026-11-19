import type { StoreApi } from 'zustand/vanilla';

import type { CountInConfig } from './config.ts';
import type { CountInScope } from './countInScope.ts';
import { initialConfig, metronomeStore, type MetronomeStore } from './store.ts';

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

type CountInBase = Pick<MetronomeStore, 'countIn' | 'countInScope'>;

function applyStoredCountIn(
  store: StoreApi<MetronomeStore>,
  persistence: CountInPersistence,
  base: CountInBase,
): void {
  const { scope, ...stored } = persistence.load();
  const state = store.getState();
  state.setCountInScope(scope ?? base.countInScope);
  const countIn = { ...base.countIn, ...stored };
  const reset = Object.keys(changedCountIn(countIn, state.countIn)).length > 0;
  if (reset || Object.keys(stored).length > 0) state.setCountIn(countIn);
}

export function bindCountInPersistence(
  store: StoreApi<MetronomeStore>,
  persistence: CountInPersistence,
): () => void {
  applyStoredCountIn(store, persistence, store.getState());
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
let configured: CountInPersistence | undefined;
let reloading = false;

export function configureCountInPersistence(
  persistence: CountInPersistence,
): () => void {
  if (unbind !== undefined) {
    throw new Error('Count-in persistence is already configured');
  }
  configured = persistence;
  unbind = bindCountInPersistence(metronomeStore, {
    load: persistence.load,
    save: (changed) => {
      // A reload mirrors storage; saving it would store defaults a Replace left absent.
      if (!reloading) persistence.save(changed);
    },
  });
  return unbind;
}

export function reloadCountInPersistence(): void {
  if (configured === undefined) return;
  reloading = true;
  try {
    applyStoredCountIn(metronomeStore, configured, initialConfig());
  } finally {
    reloading = false;
  }
}
