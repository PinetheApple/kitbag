import { useMemo } from 'react';

import { useSongLibrary } from '../songLibrary/useSongLibrary.ts';
import { singleSongsById, type LibrarySongs } from './queuedSongText.ts';
import { stemSongsById } from './stemSongText.ts';

export function useLibrarySongs(): LibrarySongs {
  const rows = useSongLibrary((s) => s.rows);
  return useMemo(
    () => ({ stems: stemSongsById(rows), songs: singleSongsById(rows) }),
    [rows],
  );
}
