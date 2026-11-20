import type { MovePhases, MoveStatus } from '@kitbag/core-native';

const FOLDER_END = '/';

export interface RowMatchIndex {
  readonly files: ReadonlyMap<string, string>;
  readonly folders: readonly (readonly [string, string])[];
}

function folderAt(path: string, end: number): string {
  return path.slice(0, end + 1);
}

function folderOf(path: string): string | null {
  const end = path.lastIndexOf(FOLDER_END);
  return end < 0 ? null : folderAt(path, end);
}

function ancestorFolders(path: string): string[] {
  const folders: string[] = [];
  for (
    let end = path.indexOf(FOLDER_END);
    end >= 0;
    end = path.indexOf(FOLDER_END, end + 1)
  )
    folders.push(folderAt(path, end));
  return folders;
}

function folderOwners(
  files: ReadonlyMap<string, string>,
): Map<string, string | null> {
  const owners = new Map<string, string | null>();
  for (const [path, key] of files)
    for (const folder of ancestorFolders(path)) {
      const owner = owners.get(folder);
      owners.set(folder, owner === undefined || owner === key ? key : null);
    }
  return owners;
}

function soleOwnerFolders(
  files: ReadonlyMap<string, string>,
  rowPaths: ReadonlyMap<string, readonly string[]>,
): Map<string, string> {
  const owners = folderOwners(files);
  const owned = new Map<string, string>();
  for (const [key, paths] of rowPaths)
    for (const path of paths) {
      const folder = folderOf(path);
      if (folder !== null && owners.get(folder) === key) owned.set(folder, key);
    }
  return owned;
}

export function rowMatchIndex(
  rowPaths: ReadonlyMap<string, readonly string[]>,
): RowMatchIndex {
  const files = new Map<string, string>();
  for (const [key, paths] of rowPaths)
    for (const path of paths) files.set(path, key);
  const folders = [...soleOwnerFolders(files, rowPaths)].sort(
    ([a], [b]) => b.length - a.length,
  );
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
