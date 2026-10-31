import { persistedStore } from '../persistedStore.ts';
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

const homeLayout = persistedStore<HomeLayoutPersistence, HomeLayoutStore>(
  'Home layout',
  { load: () => undefined, save: () => undefined },
  (persistence, commit) => ({
    arrangement: persistence.load(),
    arrange: (arrangement) => {
      commit('arrangement', arrangement, persistence.save);
    },
  }),
);

export const createHomeLayoutStore = homeLayout.create;
export const configureHomeLayoutPersistence = homeLayout.configure;
export const getHomeLayoutStore = homeLayout.get;
