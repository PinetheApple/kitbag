import type { MoveStatus } from '@kitbag/core-native';

const FOLDER_END = '/';

function folderOf(path: string): string | null {
  const end = path.lastIndexOf(FOLDER_END);
  return end < 0 ? null : path.slice(0, end + 1);
}

function holds(audioPaths: readonly string[], path: string): boolean {
  return audioPaths.some((audio) => {
    const folder = folderOf(audio);
    return folder === null ? audio === path : path.startsWith(folder);
  });
}

export function movingRowKey(
  move: MoveStatus | null,
  rowPaths: ReadonlyMap<string, readonly string[]>,
): string | null {
  if (move?.running !== true || move.switched || move.path === null)
    return null;
  const { path } = move;
  for (const [key, audioPaths] of rowPaths)
    if (holds(audioPaths, path)) return key;
  return null;
}
