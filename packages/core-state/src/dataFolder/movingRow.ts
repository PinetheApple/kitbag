import type { MovePhases, MoveStatus } from '@kitbag/core-native';

const FOLDER_END = '/';

export interface RowMatchIndex {
  readonly files: ReadonlyMap<string, string>;
  readonly folders: readonly (readonly [string, string])[];
}

function folderOf(path: string): string | null {
  const end = path.lastIndexOf(FOLDER_END);
  return end < 0 ? null : path.slice(0, end + 1);
}

// A folder names a row only when no other row's audio sits in or under it.
export function rowMatchIndex(
  rowPaths: ReadonlyMap<string, readonly string[]>,
): RowMatchIndex {
  const files = new Map<string, string>();
  for (const [key, paths] of rowPaths)
    for (const path of paths) files.set(path, key);
  const owned = new Map<string, string>();
  for (const [key, paths] of rowPaths)
    for (const path of paths) {
      const folder = folderOf(path);
      if (folder === null || owned.has(folder)) continue;
      const alone = [...files].every(
        ([other, owner]) => owner === key || !other.startsWith(folder),
      );
      if (alone) owned.set(folder, key);
    }
  const folders = [...owned].sort(([a], [b]) => b.length - a.length);
  return { files, folders };
}

function copying(move: MoveStatus, phases: MovePhases): boolean {
  return move.phase === phases.copying || move.phase === phases.catchUp;
}

export function movingRowKey(
  move: MoveStatus | null,
  phases: MovePhases,
  index: RowMatchIndex,
): string | null {
  if (move?.running !== true || move.switched || move.path === null)
    return null;
  if (!copying(move, phases)) return null;
  const { path } = move;
  const exact = index.files.get(path);
  if (exact !== undefined) return exact;
  return index.folders.find(([folder]) => path.startsWith(folder))?.[1] ?? null;
}
