import type { LibraryRow, SongLibraryRepository } from '@kitbag/core-db';

import type { StoredRowFiles } from './missingRows.ts';

export type StoredFilesRecords = Pick<
  SongLibraryRepository,
  'list' | 'listSongFiles' | 'readStemSet'
>;

async function audioPaths(
  records: StoredFilesRecords,
  row: LibraryRow,
  songPaths: ReadonlyMap<number, string>,
): Promise<readonly string[]> {
  if (row.kind === 'stems') {
    const set = await records.readStemSet(row.id);
    return set?.stems.map((stem) => stem.filePath) ?? [];
  }
  const path = songPaths.get(row.id);
  return path === undefined ? [] : [path];
}

export async function storedRowFiles(
  records: StoredFilesRecords,
): Promise<StoredRowFiles[]> {
  const songPaths = new Map(
    (await records.listSongFiles()).map(({ id, filePath }) => [id, filePath]),
  );
  const stored: StoredRowFiles[] = [];
  for (const row of await records.list())
    stored.push({ row, audioPaths: await audioPaths(records, row, songPaths) });
  return stored;
}
