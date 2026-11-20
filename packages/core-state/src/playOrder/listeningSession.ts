import { sameQueuedSong, type QueuedSong } from '@kitbag/core-db';

import { libraryStore } from '../library/store.ts';
import { songPlayerStore } from '../songPlayer/store.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';
import { shownSong } from './nowPlaying.ts';
import { forgetHeard, hearSong } from './heard.ts';
import { heardOf } from './previous.ts';

type CardStops = (listener: () => void) => () => void;

export interface ListeningDeps {
  readonly cardStops: readonly CardStops[];
  readonly closePlayers: () => void;
  readonly endSession: () => void;
}

export function endListeningSession(): void {
  libraryStore.getState().endListeningSession();
  forgetHeard();
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
  endSession: endListeningSession,
};

export function stopSongAndSession(deps: ListeningDeps = defaultDeps) {
  deps.closePlayers();
  deps.endSession();
}

export function endSessionOnCardStop(deps: ListeningDeps = defaultDeps) {
  const stops = deps.cardStops.map((onCardStop) => onCardStop(deps.endSession));
  return () => {
    stops.forEach((stop) => {
      stop();
    });
  };
}

export interface HeardDeps {
  readonly shown: () => QueuedSong | null;
  readonly subscribe: (listener: () => void) => () => void;
  readonly hear: (song: QueuedSong) => void;
}

const heardDeps: HeardDeps = {
  shown: shownSong,
  subscribe: (listener) => {
    const stops = [
      stemPlayerStore.subscribe(listener),
      songPlayerStore.subscribe(listener),
    ];
    return () => {
      stops.forEach((stop) => {
        stop();
      });
    };
  },
  hear: (song) => {
    hearSong(heardOf(song, libraryStore.getState().loaded));
  },
};

export function recordHeardSongs(deps: HeardDeps = heardDeps) {
  let last: QueuedSong | null = null;
  const look = () => {
    const song = deps.shown();
    const same = song !== null && last !== null && sameQueuedSong(song, last);
    last = song;
    if (song !== null && !same) deps.hear(song);
  };
  look();
  return deps.subscribe(look);
}
