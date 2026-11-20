import { songPlayerStore } from '../songPlayer/store.ts';
import { useSongPlayer } from '../songPlayer/useSongPlayer.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';
import { useStemPlayer } from '../stemPlayer/useStemPlayer.ts';
import type { PlayerKind } from './order.ts';
import { songShown, stemShown } from './shown.ts';

export function useShownSongId(): number | null {
  return useSongPlayer((s) => (songShown(s) ? s.songId : null));
}

export function useShownStemSetId(): number | null {
  return useStemPlayer((s) => (stemShown(s) ? s.setId : null));
}

export function playingKind(): PlayerKind | null {
  if (stemShown(stemPlayerStore.getState())) return 'stems';
  return songShown(songPlayerStore.getState()) ? 'song' : null;
}
