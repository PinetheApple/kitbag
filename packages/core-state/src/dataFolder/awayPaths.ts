import type { StoredRowFiles } from '../storage/missingRows.ts';

export function awayPaths(stored: readonly StoredRowFiles[]): string[] {
  return [...new Set(stored.flatMap((row) => row.audioPaths))].sort();
}
