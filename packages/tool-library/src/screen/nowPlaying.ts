import {
  useShownSongId,
  useShownStemSetId,
  type LibraryRow,
} from '@kitbag/core-state';

export function useNowPlaying(row: LibraryRow): boolean {
  const songId = useShownSongId();
  const setId = useShownStemSetId();
  return row.id === (row.kind === 'stems' ? setId : songId);
}
