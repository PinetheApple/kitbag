import type { SongLibraryRepository } from '@kitbag/core-db';

import type { StoredRowFiles } from './missingRows.ts';

export type StoredFilesRecords = Pick<
  SongLibraryRepository,
  'list' | 'listSongFiles' | 'listStemFiles'
>;

interface RowPaths {
  readonly audio: string[];
  readonly waveforms: string[];
}

const NO_PATHS: RowPaths = { audio: [], waveforms: [] };

function withFile(
  paths: RowPaths | undefined,
  filePath: string,
  waveformPath: string | null,
): RowPaths {
  const { audio, waveforms } = paths ?? NO_PATHS;
  return {
    audio: [...audio, filePath],
    waveforms: waveformPath === null ? waveforms : [...waveforms, waveformPath],
  };
}

export async function storedRowFiles(
  records: StoredFilesRecords,
): Promise<StoredRowFiles[]> {
  const songs = new Map<number, RowPaths>();
  for (const { id, filePath, waveformPath } of await records.listSongFiles())
    songs.set(id, withFile(songs.get(id), filePath, waveformPath));
  const stems = new Map<number, RowPaths>();
  for (const { setId, filePath, waveformPath } of await records.listStemFiles())
    stems.set(setId, withFile(stems.get(setId), filePath, waveformPath));
  return (await records.list()).map((row) => {
    const paths =
      (row.kind === 'stems' ? stems : songs).get(row.id) ?? NO_PATHS;
    return { row, audioPaths: paths.audio, waveformPaths: paths.waveforms };
  });
}
