import {
  ANALYSIS_STATUS,
  type LibraryRow,
  type LibrarySongRow,
  type SongFiles,
} from '@kitbag/core-db';
import type { LibraryConstants } from '@kitbag/core-native';

export const LIBRARY_CHIPS = ['all', 'analyzed', 'stems', 'setlists'] as const;

export type LibraryChip = (typeof LIBRARY_CHIPS)[number];

export type SongBadge = 'pending' | 'analyzing' | 'grid' | 'noGrid' | 'failed';

export interface LibrarySummary {
  readonly songCount: number;
  readonly analyzedCount: number;
  readonly stemSongCount: number;
}

export function isLibraryChip(value: unknown): value is LibraryChip {
  return LIBRARY_CHIPS.some((chip) => chip === value);
}

export type FailureKind =
  'missingFile' | 'unsupported' | 'interrupted' | 'other';

export interface AnalysisFailure {
  readonly kind: FailureKind;
  readonly keptGrid: boolean;
}

// A failed re-analysis keeps the grid it was replacing, so the grid still stands.
export function songBadge(song: LibrarySongRow): SongBadge {
  switch (song.analysisStatus) {
    case ANALYSIS_STATUS.pending:
      return 'pending';
    case ANALYSIS_STATUS.analyzing:
      return 'analyzing';
    case ANALYSIS_STATUS.failed:
      return song.hasGrid ? 'grid' : 'failed';
    case ANALYSIS_STATUS.done:
      return song.hasGrid ? 'grid' : 'noGrid';
  }
}

export function failureKind(
  error: string | null,
  codes: LibraryConstants | null,
): FailureKind {
  if (codes === null || error === null) return 'other';
  if (error === codes.failureMissingFile) return 'missingFile';
  if (error === codes.failureUnsupported) return 'unsupported';
  if (error === codes.failureInterrupted) return 'interrupted';
  return 'other';
}

export function analysisFailure(
  song: LibrarySongRow,
  codes: LibraryConstants | null,
): AnalysisFailure | null {
  if (song.analysisStatus !== ANALYSIS_STATUS.failed) return null;
  return {
    kind: failureKind(song.analysisError, codes),
    keptGrid: song.hasGrid,
  };
}

function isAnalyzed(row: LibraryRow): boolean {
  if (row.kind !== 'song') return false;
  const badge = songBadge(row);
  return badge === 'grid' || badge === 'noGrid';
}

function chipAdmits(row: LibraryRow, chip: LibraryChip): boolean {
  switch (chip) {
    case 'all':
      return true;
    case 'analyzed':
      return isAnalyzed(row);
    case 'stems':
      return row.kind === 'stems';
    case 'setlists':
      return row.kind === 'song' && row.inSetlist;
  }
}

function searchAdmits(row: LibraryRow, needle: string): boolean {
  if (needle === '') return true;
  const artist = row.kind === 'song' ? row.artist : '';
  return [row.title, artist].some((field) =>
    field.toLocaleLowerCase().includes(needle),
  );
}

export function filterRows(
  rows: readonly LibraryRow[],
  query: string,
  chip: LibraryChip,
): LibraryRow[] {
  const needle = query.trim().toLocaleLowerCase();
  return rows.filter(
    (row) => chipAdmits(row, chip) && searchAdmits(row, needle),
  );
}

export function summarize(rows: readonly LibraryRow[]): LibrarySummary {
  return {
    songCount: rows.filter((row) => row.kind === 'song').length,
    analyzedCount: rows.filter(isAnalyzed).length,
    stemSongCount: rows.filter((row) => row.kind === 'stems').length,
  };
}

const ZIP_EXTENSION = '.zip';

export function isStemArchive(file: {
  readonly name: string;
  readonly mimeType: string;
}): boolean {
  return (
    file.mimeType.includes('zip') ||
    file.name.toLocaleLowerCase().endsWith(ZIP_EXTENSION)
  );
}

export function parentDir(relativePath: string): string {
  const slash = relativePath.lastIndexOf('/');
  return slash < 0 ? '' : relativePath.slice(0, slash);
}

export function audioFormat(relativePath: string): string {
  const name = relativePath.slice(relativePath.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLocaleLowerCase();
}

export function songFolder(songsDir: string, songUuid: string): string {
  return `${songsDir}/${songUuid}`;
}

export type Removal =
  | { readonly kind: 'folder'; readonly name: string }
  | { readonly kind: 'stemFolder'; readonly name: string }
  | { readonly kind: 'file'; readonly path: string };

export function fileRemovals(paths: readonly (string | null)[]): Removal[] {
  return paths.flatMap((path) =>
    path === null ? [] : [{ kind: 'file' as const, path }],
  );
}

const FOLDER_NAME = /^[0-9A-Za-z-]+$/;

// The folder is removed whole only when it is named by this row's own uuid,
// which import gave it; any other layout may share a parent with other songs.
export function songRemovals(
  song: SongFiles,
  songsDir: string | null,
): Removal[] {
  const folder = `${songFolder(songsDir ?? '', song.uuid)}/`;
  const ownsFolder =
    songsDir !== null &&
    FOLDER_NAME.test(song.uuid) &&
    song.filePath.startsWith(folder) &&
    !song.filePath.slice(folder.length).includes('/');
  const files = [song.filePath, song.waveformPath];
  if (!ownsFolder) return fileRemovals(files);
  const outside = files.filter((path) => !path?.startsWith(folder));
  return [{ kind: 'folder', name: song.uuid }, ...fileRemovals(outside)];
}
