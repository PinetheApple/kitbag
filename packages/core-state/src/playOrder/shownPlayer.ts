import type { QueuedSong } from '@kitbag/core-db';

import { songPlayerStore } from '../songPlayer/store.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';
import { stopSongAndSession } from './listeningSession.ts';
import { shownSong } from './nowPlaying.ts';
import type { PlayerKind } from './order.ts';
import { playOrderStore } from './store.ts';

export interface ShownPlayer {
  readonly shown: () => QueuedSong | null;
  readonly pauseIfSounding: (kind: PlayerKind) => boolean;
  readonly hasNext: () => boolean;
  readonly next: (kind: PlayerKind, wasPlaying: boolean) => void;
  readonly close: () => void;
}

const players = { stems: stemPlayerStore, song: songPlayerStore };

export const shownPlayer: ShownPlayer = {
  shown: shownSong,
  pauseIfSounding: (kind) => players[kind].getState().pauseIfSounding(),
  hasNext: () => playOrderStore.getState().upNext() !== undefined,
  next: (kind, wasPlaying) => {
    const player = players[kind].getState();
    if (wasPlaying) player.pressNext();
    else player.pressNextPaused();
  },
  close: () => {
    stopSongAndSession();
  },
};
