import type { StoredRowFiles } from '../storage/missingRows.ts';

export function awayPaths(stored: readonly StoredRowFiles[]): string[] {
  const paths = stored.flatMap((row) => [
    ...row.audioPaths,
    ...(row.waveformPaths ?? []),
  ]);
  return [...new Set(paths)].sort();
}
