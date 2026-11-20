import {
  useSongPlayer,
  useStemPlayer,
  type LibraryRow,
  type SongPlayerStore,
  type StemPlayerStore,
} from '@kitbag/core-state';

export const songShown = (s: SongPlayerStore) => s.status === 'ready';

export const stemShown = (s: StemPlayerStore) =>
  s.status === 'ready' || (s.status === 'loading' && s.advancedTo !== null);

export function useShownSongId(): number | null {
  return useSongPlayer((s) => (songShown(s) ? s.songId : null));
}

export function useShownStemSetId(): number | null {
  return useStemPlayer((s) => (stemShown(s) ? s.setId : null));
}

export function useNowPlaying(row: LibraryRow): boolean {
  const songId = useShownSongId();
  const setId = useShownStemSetId();
  return row.id === (row.kind === 'stems' ? setId : songId);
}
