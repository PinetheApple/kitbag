import { libraryStore, type LibraryState } from '../library/store.ts';
import { metronomeStore, type MetronomeActions } from '../metronome/store.ts';
import { songPlayerStore } from '../songPlayer/store.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';

type SongLoads = Pick<LibraryState, 'songLoads'>;

interface SongPlayer {
  readonly getState: () => { readonly close: () => void };
}

export interface MetronomeTakeoverDeps {
  readonly loads: {
    readonly subscribe: (
      listener: (state: SongLoads, previous: SongLoads) => void,
    ) => () => void;
  };
  readonly metronome: Pick<MetronomeActions, 'onStarting'>;
  readonly players: readonly SongPlayer[];
}

const defaultDeps: MetronomeTakeoverDeps = {
  loads: libraryStore,
  metronome: {
    onStarting: (listener) => metronomeStore.getState().onStarting(listener),
  },
  players: [stemPlayerStore, songPlayerStore],
};

export function stopSongsForMetronome(
  deps: MetronomeTakeoverDeps = defaultDeps,
) {
  const closeSongs = () => {
    for (const player of deps.players) player.getState().close();
  };
  const stopLoads = deps.loads.subscribe((state, previous) => {
    if (state.songLoads !== previous.songLoads) closeSongs();
  });
  const stopStarts = deps.metronome.onStarting(closeSongs);
  return () => {
    stopLoads();
    stopStarts();
  };
}
