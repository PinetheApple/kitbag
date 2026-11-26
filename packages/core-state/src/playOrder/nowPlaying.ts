import type { QueuedSong } from '@kitbag/core-db';

import { songPlayerStore } from '../songPlayer/store.ts';
import { useLiveSongPlayer } from '../songPlayer/useSongPlayer.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';
import { useLiveStemPlayer } from '../stemPlayer/useStemPlayer.ts';
import type { PlayerKind } from './order.ts';
import { songShown, stemShown } from './shown.ts';

export function useShownSongId(): number | null {
  return useLiveSongPlayer((s) => (songShown(s) ? s.songId : null));
}

export function useShownStemSetId(): number | null {
  return useLiveStemPlayer((s) => (stemShown(s) ? s.setId : null));
}

export function playingKind(): PlayerKind | null {
  if (stemShown(stemPlayerStore.getState())) return 'stems';
  return songShown(songPlayerStore.getState()) ? 'song' : null;
}

export function shownSongOf(
  setId: number | null,
  songId: number | null,
): QueuedSong | null {
  if (setId !== null) return { kind: 'stems', id: setId };
  return songId === null ? null : { kind: 'song', id: songId };
}

export function shownSong(): QueuedSong | null {
  const stems = stemPlayerStore.getState();
  const single = songPlayerStore.getState();
  return shownSongOf(
    stemShown(stems) ? stems.setId : null,
    songShown(single) ? single.songId : null,
  );
}

export function useShownLoopHeld(): boolean {
  const stems = useLiveStemPlayer((s) => stemShown(s) && s.loop.kind === 'on');
  const single = useLiveSongPlayer((s) => songShown(s) && s.loop.kind === 'on');
  return stems || single;
}

export function useShownSong(): QueuedSong | null {
  return shownSongOf(useShownStemSetId(), useShownSongId());
}
