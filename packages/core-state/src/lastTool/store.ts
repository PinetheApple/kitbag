// Which tool the user last opened, for Home's Continue card (SPEC §12.4). The
// id is opaque here: core-state does not know the tool roster, so Home checks
// it against its own list before trusting it.

import { createStore, type StoreApi } from 'zustand/vanilla';

export interface LastToolPersistence {
  readonly load: () => string | undefined;
  readonly save: (toolId: string) => void;
}

export interface LastToolStore {
  readonly toolId: string | undefined;
  readonly markUsed: (toolId: string) => void;
}

// Session-only until a platform supplies storage: there is no native
// key-value store in the app yet.
const inMemory: LastToolPersistence = {
  load: () => undefined,
  save: () => undefined,
};

export function createLastToolStore(
  persistence: LastToolPersistence = inMemory,
): StoreApi<LastToolStore> {
  return createStore<LastToolStore>((set, get) => ({
    toolId: persistence.load(),
    markUsed: (toolId) => {
      if (get().toolId === toolId) return;
      set({ toolId });
      persistence.save(toolId);
    },
  }));
}

let configured: StoreApi<LastToolStore> | undefined;

/** Install the platform's storage. Call once, before Home first renders. */
export function configureLastToolPersistence(
  persistence: LastToolPersistence,
): void {
  if (configured !== undefined) {
    throw new Error(
      'Last-tool store already exists; configure persistence before first use',
    );
  }
  configured = createLastToolStore(persistence);
}

export function getLastToolStore(): StoreApi<LastToolStore> {
  configured ??= createLastToolStore();
  return configured;
}
