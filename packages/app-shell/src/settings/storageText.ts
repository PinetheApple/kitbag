import { countLabel } from '@kitbag/core-design';
import type { StorageReport } from '@kitbag/core-native';

import { formatBytes } from './bytes.ts';
import { SEPARATOR } from './separator.ts';

export const STORAGE_LABEL = 'Storage';
export const REMOVAL_FAILED = 'Some files could not be removed. Try again.';

const fileCount = (count: number) => countLabel(count, 'file', 'files');

export function storageSummary(report: StorageReport): string {
  const bytes =
    report.libraryAudio.bytes + report.stemSets.bytes + report.database.bytes;
  const files = report.libraryAudio.songs + report.stemSets.count;
  return `${formatBytes(bytes)} ${SEPARATOR} ${fileCount(files)}`;
}

export function libraryAudioText({ libraryAudio }: StorageReport): string {
  return `${fileCount(libraryAudio.songs)} ${SEPARATOR} ${formatBytes(libraryAudio.bytes)}`;
}

export function stemSetsText({ stemSets }: StorageReport): string {
  return `${String(stemSets.count)} ${SEPARATOR} ${formatBytes(stemSets.bytes)}`;
}

export function databaseText({ database }: StorageReport): string {
  return formatBytes(database.bytes);
}

export function removeMissingLabel(count: number): string {
  return `Remove missing files (${String(count)})`;
}

export function removeMissingTitle(count: number): string {
  return `Remove ${countLabel(count, 'missing song', 'missing songs')}?`;
}
