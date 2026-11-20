import type { LibraryStemSetRow } from '@kitbag/core-db';
import { useMemo } from 'react';

import { useSongLibrary } from '../songLibrary/useSongLibrary.ts';
import { stemSongsById } from './stemSongText.ts';

export function useStemSongs(): ReadonlyMap<number, LibraryStemSetRow> {
  const rows = useSongLibrary((s) => s.rows);
  return useMemo(() => stemSongsById(rows), [rows]);
}
