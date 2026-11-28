import {
  ANALYSIS_STATUS,
  type DeletedSong,
  type LibraryRow,
} from '@kitbag/core-db';
import type { LibraryConstants } from '@kitbag/core-native';

import { songRemovals, type Removal } from './logic.ts';
import { requeueAndRefresh, type OutdatedGridQueue } from './outdatedGrids.ts';
import { stemSetRemovals } from './stemBundleLogic.ts';
import type { SongLibraryDeps } from './store.ts';
import {
  deleteLeftovers,
  loadCodes,
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

interface DeletedRecord {
  readonly removals: Removal[];
  readonly song?: DeletedSong;
}

const UNFINISHED: ReadonlySet<string> = new Set([
  ANALYSIS_STATUS.pending,
  ANALYSIS_STATUS.analyzing,
]);

async function deleteRecord(
  deps: SongLibraryDeps,
  queue: OutdatedGridQueue,
  row: LibraryRow,
  codes: LibraryConstants | null,
): Promise<DeletedRecord> {
  const records = deps.records();
  if (row.kind === 'stems') {
    const stemSet = await records.deleteStemSet(row.id);
    return { removals: stemSetRemovals(stemSet, codes?.stemsDir ?? null) };
  }
  const song = await records.deleteSong(row.id);
  if (song === undefined) return { removals: [] };
  deps.files().cancelAnalysis(song.row.filePath);
  await queue.settled(song.row.filePath);
  return { removals: songRemovals(song.row, codes?.songsDir ?? null), song };
}

export function rowDeletion(
  deps: SongLibraryDeps,
  set: SetState,
  get: Get,
  queue: OutdatedGridQueue,
) {
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
  const remove = async (row: LibraryRow, undoable: boolean) => {
    let deleted: DeletedRecord;
    try {
      deleted = await deleteRecord(deps, queue, row, loadCodes(deps, get));
    } catch (error) {
      warn(`delete of ${row.title} failed`, error);
      set({ notice: { kind: 'deleteFailed', name: row.title } });
      return;
    }
    await get().refresh();
    const { song, removals } = deleted;
    if (!undoable || song === undefined) {
      await deleteLeftovers(deps.files(), removals, row.title);
      return;
    }
    await dropDeletedSong();
    set({
      deletedSong: { title: row.title, song, removals, at: deps.now() },
    });
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
    deleteRow: (row: LibraryRow) => remove(row, false),
    deleteRowWithUndo: (row: LibraryRow) => remove(row, true),
    undoDeleteSong,
    dismissDeletedSong: dropDeletedSong,
  };
}
