import { ANALYSIS_STATUS, type DeletedSong } from '@kitbag/core-db';

import type { Removal } from './logic.ts';
import { requeueAndRefresh } from './outdatedGrids.ts';
import type { SongLibraryDeps } from './store.ts';
import {
  deleteLeftovers,
  warn,
  type Get,
  type SetState,
} from './storeSupport.ts';

export interface DeletedLibrarySong {
  readonly title: string;
  readonly song: DeletedSong;
  readonly removals: readonly Removal[];
  readonly at: number;
}

const UNFINISHED: ReadonlySet<string> = new Set([
  ANALYSIS_STATUS.pending,
  ANALYSIS_STATUS.analyzing,
]);

export function songDeletion(deps: SongLibraryDeps, set: SetState, get: Get) {
  const dropDeletedSong = async () => {
    const { deletedSong } = get();
    if (deletedSong === null) return;
    set({ deletedSong: null });
    await deleteLeftovers(
      deps.files(),
      deletedSong.removals,
      deletedSong.title,
    );
  };
  const holdDeletedSong = async (
    title: string,
    song: DeletedSong,
    removals: readonly Removal[],
  ) => {
    await dropDeletedSong();
    set({ deletedSong: { title, song, removals, at: Date.now() } });
  };
  const undoDeleteSong = async () => {
    const { deletedSong } = get();
    if (deletedSong === null) return;
    set({ deletedSong: null });
    const { song, removals, title } = deletedSong;
    try {
      await deps.records().restoreSong(song);
    } catch (error) {
      warn(`restoring ${title} failed`, error);
      await deleteLeftovers(deps.files(), removals, title);
      await get().refresh();
      return;
    }
    if (UNFINISHED.has(song.row.analysisStatus))
      await requeueAndRefresh(deps, get, song.row.id);
    else await get().refresh();
  };
  return {
    holdDeletedSong,
    undoDeleteSong,
    dismissDeletedSong: dropDeletedSong,
  };
}
