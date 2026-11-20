import { libraryStore } from '../library/store.ts';
import { songPlayerStore } from '../songPlayer/store.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';

type CardStops = (listener: () => void) => () => void;

export interface ListeningDeps {
  readonly cardStops: readonly CardStops[];
  readonly closePlayers: () => void;
  readonly endSession: () => void;
}

const defaultDeps: ListeningDeps = {
  cardStops: [
    (listener) => songPlayerStore.getState().onCardStop(listener),
    (listener) => stemPlayerStore.getState().onCardStop(listener),
  ],
  closePlayers: () => {
    songPlayerStore.getState().close();
    stemPlayerStore.getState().close();
  },
  endSession: () => {
    libraryStore.getState().endListeningSession();
  },
};

export function stopListening(deps: ListeningDeps = defaultDeps) {
  deps.closePlayers();
  deps.endSession();
}

export function startListeningSession(deps: ListeningDeps = defaultDeps) {
  const stops = deps.cardStops.map((onCardStop) => onCardStop(deps.endSession));
  return () => {
    stops.forEach((stop) => {
      stop();
    });
  };
}
