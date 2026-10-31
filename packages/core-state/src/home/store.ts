import { createStore, type StoreApi } from 'zustand/vanilla';

import type { Arrangement } from './arrangement.ts';

export type SavedArrangement = Arrangement<string>;

export interface HomeLayoutPersistence {
  readonly load: () => SavedArrangement | undefined;
  readonly save: (arrangement: SavedArrangement) => void;
}

// Undefined until the user arranges Home; Home then shows its default order.
export interface HomeLayoutStore {
  readonly arrangement: SavedArrangement | undefined;
  readonly arrange: (arrangement: SavedArrangement) => void;
}

const inMemory: HomeLayoutPersistence = {
  load: () => undefined,
  save: () => undefined,
};

export function createHomeLayoutStore(
  persistence: HomeLayoutPersistence = inMemory,
): StoreApi<HomeLayoutStore> {
  return createStore<HomeLayoutStore>((set, get) => ({
    arrangement: persistence.load(),
    arrange: (arrangement) => {
      if (get().arrangement === arrangement) return;
      set({ arrangement });
      persistence.save(arrangement);
    },
  }));
}

let configured: StoreApi<HomeLayoutStore> | undefined;

export function configureHomeLayoutPersistence(
  persistence: HomeLayoutPersistence,
): void {
  if (configured !== undefined) {
    throw new Error(
      'Home layout store already exists; configure persistence before first use',
    );
  }
  configured = createHomeLayoutStore(persistence);
}

export function getHomeLayoutStore(): StoreApi<HomeLayoutStore> {
  configured ??= createHomeLayoutStore();
  return configured;
}
