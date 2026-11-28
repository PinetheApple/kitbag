import type { HeldSongFiles } from '@kitbag/core-db';

import type { SongFileRecord } from './runtime.ts';
import { songFolder, songRemovals, type Removal } from './logic.ts';
import type { SongLibraryDeps } from './store.ts';
import type { FileWorkTracker } from './stemFolderSweep.ts';
import { deleteLeftovers, loadCodes, warn, type Get } from './storeSupport.ts';

export async function releaseHeldSongFiles(
  deps: SongLibraryDeps,
  songId: number,
): Promise<void> {
  try {
    await deps.records().releaseSongFiles(songId);
  } catch (error) {
    warn(`held files of song ${String(songId)} not released`, error);
  }
}

function pathsInUse(rows: readonly SongFileRecord[]): Set<string> {
  return new Set(
    rows.flatMap(({ filePath, waveformPath }) =>
      waveformPath === null ? [filePath] : [filePath, waveformPath],
    ),
  );
}

function inUse(removal: Removal, paths: Set<string>, songsDir: string) {
  if (removal.kind === 'file') return paths.has(removal.path);
  if (removal.kind === 'stemFolder') return true;
  const folder = `${songFolder(songsDir, removal.name)}/`;
  return [...paths].some((path) => path.startsWith(folder));
}

export async function finishHeldSongDeletions(
  deps: SongLibraryDeps,
  get: Get,
  fileWork: FileWorkTracker,
): Promise<void> {
  const mark = fileWork.idleMark();
  const codes = loadCodes(deps, get);
  if (mark === null || codes === null) return;
  const records = deps.records();
  let held: readonly HeldSongFiles[];
  let paths: Set<string>;
  try {
    held = await records.listHeldSongFiles();
    if (held.length === 0) return;
    paths = pathsInUse(await records.listSongFiles());
  } catch (error) {
    warn('deleted song files not finished', error);
    return;
  }
  if (!fileWork.stillIdleSince(mark)) return;
  const offered = get().deletedSong?.song.row.id;
  for (const files of held) {
    if (files.songId === offered) continue;
    const removals = songRemovals(files, codes.songsDir).filter(
      (removal) => !inUse(removal, paths, codes.songsDir),
    );
    if (await deleteLeftovers(deps.files(), removals, 'a deleted song'))
      await releaseHeldSongFiles(deps, files.songId);
  }
}
