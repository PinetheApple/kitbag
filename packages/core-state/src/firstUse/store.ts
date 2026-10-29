import { createStore, type StoreApi } from 'zustand/vanilla';

export interface SwipeHintPersistence {
  readonly load: () => boolean;
  readonly save: () => void;
}

export interface SwipeHintStore {
  readonly seen: boolean;
  readonly dismiss: () => void;
}

const inMemory: SwipeHintPersistence = {
  load: () => false,
  save: () => undefined,
};

export function createSwipeHintStore(
  persistence: SwipeHintPersistence = inMemory,
): StoreApi<SwipeHintStore> {
  return createStore<SwipeHintStore>((set, get) => ({
    seen: persistence.load(),
    dismiss: () => {
      if (get().seen) return;
      set({ seen: true });
      persistence.save();
    },
  }));
}

let configured: StoreApi<SwipeHintStore> | undefined;

export function configureSwipeHintPersistence(
  persistence: SwipeHintPersistence,
): void {
  if (configured !== undefined) {
    throw new Error(
      'Swipe-hint store already exists; configure persistence before first use',
    );
  }
  configured = createSwipeHintStore(persistence);
}

export function getSwipeHintStore(): StoreApi<SwipeHintStore> {
  configured ??= createSwipeHintStore();
  return configured;
}
