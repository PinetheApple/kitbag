import type { HeldSongFiles } from '@kitbag/core-db';

import type { FileWorkTracker } from './fileWork.ts';
import {
  songFolder,
  songRemovals,
  type Removal,
  type SongRemoval,
} from './logic.ts';
import type { SongFileRecord } from './runtime.ts';
import type { SongLibraryDeps } from './store.ts';
import { deleteLeftovers, loadCodes, warn, type Get } from './storeSupport.ts';

export async function deleteHeldSongFiles(
  deps: SongLibraryDeps,
  songId: number,
  removals: readonly Removal[],
  label: string,
): Promise<void> {
  if (!(await deleteLeftovers(deps.files(), removals, label))) return;
  try {
    await deps.records().releaseSongFiles(songId);
  } catch (error) {
    warn(`held files of ${label} not released`, error);
  }
}

function pathsInUse(rows: readonly SongFileRecord[]): Set<string> {
  return new Set(
    rows.flatMap(({ filePath, waveformPath }) =>
      waveformPath === null ? [filePath] : [filePath, waveformPath],
    ),
  );
}

function inUse(removal: SongRemoval, paths: Set<string>, songsDir: string) {
  if (removal.kind === 'file') return paths.has(removal.path);
  const folder = `${songFolder(songsDir, removal.name)}/`;
  return [...paths].some((path) => path.startsWith(folder));
}

export async function finishHeldSongDeletions(
  deps: SongLibraryDeps,
  get: Get,
  fileWork: FileWorkTracker,
): Promise<void> {
  // A delete or Undo in flight moves rows and the held record out of step, so
  // only a window with none running is trusted.
  const mark = fileWork.idleMark();
  const codes = loadCodes(deps, get);
  if (mark === null || codes === null) return;
  const records = deps.records();
  let held: readonly HeldSongFiles[];
  try {
    held = await records.listHeldSongFiles();
  } catch (error) {
    warn('deleted song files not finished', error);
    return;
  }
  for (const files of held) {
    if (files.songId === get().deletedSong?.song.row.id) continue;
    let paths: Set<string>;
    try {
      paths = pathsInUse(await records.listSongFiles());
    } catch (error) {
      warn('deleted song files not finished', error);
      return;
    }
    if (!fileWork.stillIdleSince(mark)) return;
    const removals = songRemovals(files, codes.songsDir).filter(
      (removal) => !inUse(removal, paths, codes.songsDir),
    );
    await deleteHeldSongFiles(deps, files.songId, removals, 'a deleted song');
  }
}
