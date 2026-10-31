import type { LibraryRow, SongLibraryRepository } from '@kitbag/core-db';

import type { StoredRowFiles } from './missingRows.ts';

export type StoredFilesRecords = Pick<
  SongLibraryRepository,
  'list' | 'listSongFiles' | 'listStemFiles'
>;

function pathsOf(
  row: LibraryRow,
  songs: ReadonlyMap<number, string>,
  stems: ReadonlyMap<number, string[]>,
) {
  if (row.kind === 'stems') return stems.get(row.id) ?? [];
  const path = songs.get(row.id);
  return path === undefined ? [] : [path];
}

export async function storedRowFiles(
  records: StoredFilesRecords,
): Promise<StoredRowFiles[]> {
  const songs = new Map(
    (await records.listSongFiles()).map(({ id, filePath }) => [id, filePath]),
  );
  const stems = new Map<number, string[]>();
  for (const { setId, filePath } of await records.listStemFiles())
    stems.set(setId, [...(stems.get(setId) ?? []), filePath]);
  return (await records.list()).map((row) => ({
    row,
    audioPaths: pathsOf(row, songs, stems),
  }));
}
