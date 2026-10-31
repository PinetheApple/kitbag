// Which tool the user last opened, for Home's Continue card (SPEC §12.4). The
// id is opaque here: Home checks it against its own roster before trusting it.

import { persistedStore } from '../persistedStore.ts';

export interface LastToolPersistence {
  readonly load: () => string | undefined;
  readonly save: (toolId: string) => void;
}

export interface LastToolStore {
  readonly toolId: string | undefined;
  readonly markUsed: (toolId: string) => void;
}

const lastTool = persistedStore<LastToolPersistence, LastToolStore>(
  'Last-tool',
  { load: () => undefined, save: () => undefined },
  (persistence, commit) => ({
    toolId: persistence.load(),
    markUsed: (toolId) => {
      commit('toolId', toolId, persistence.save);
    },
  }),
);

export const createLastToolStore = lastTool.create;
/** Install the platform's storage. Call once, before Home first renders. */
export const configureLastToolPersistence = lastTool.configure;
export const getLastToolStore = lastTool.get;
