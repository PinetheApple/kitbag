import { persistedStore } from '../persistedStore.ts';

export interface ToolsPersistence {
  readonly load: () => readonly string[];
  readonly save: (off: readonly string[]) => void;
}

// Holds the tools switched off, not on, so a tool added later starts on.
export interface ToolsStore {
  readonly off: readonly string[];
  readonly setOff: (off: readonly string[]) => void;
}

const tools = persistedStore<ToolsPersistence, ToolsStore>(
  'Tools',
  { load: () => [], save: () => undefined },
  (persistence, commit) => ({
    off: persistence.load(),
    setOff: (off) => {
      commit('off', off, persistence.save);
    },
  }),
);

export const createToolsStore = tools.create;
export const configureToolsPersistence = tools.configure;
export const getToolsStore = tools.get;
