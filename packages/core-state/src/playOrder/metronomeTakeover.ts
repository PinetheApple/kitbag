import { libraryStore, type LibraryState } from '../library/store.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';

type SongLoads = Pick<LibraryState, 'songLoads'>;

export interface MetronomeTakeoverDeps {
  readonly loads: {
    readonly subscribe: (
      listener: (state: SongLoads, previous: SongLoads) => void,
    ) => () => void;
  };
  readonly closeStemSong: () => void;
}

const defaultDeps: MetronomeTakeoverDeps = {
  loads: libraryStore,
  closeStemSong: () => {
    stemPlayerStore.getState().close();
  },
};

export function stopStemSongOnMetronomeLoad(
  deps: MetronomeTakeoverDeps = defaultDeps,
) {
  return deps.loads.subscribe((state, previous) => {
    if (state.songLoads !== previous.songLoads) deps.closeStemSong();
  });
}
