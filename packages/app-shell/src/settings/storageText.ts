import { countLabel } from '@kitbag/core-design';
import type { StorageReport } from '@kitbag/core-native';

import { formatBytes } from './bytes.ts';

const SEPARATOR = '·';

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
